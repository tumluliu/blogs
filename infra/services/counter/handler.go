package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"regexp"
	"strings"
)

var (
	slugRe        = regexp.MustCompile(`^[\p{L}\p{N}_-]{1,200}$`)
	botUARe       = regexp.MustCompile(`(?i)(bot|crawler|spider|preview|wget|curl)`)
	allowedOrigin = "https://luliu.me"
)

// NewMux builds the full HTTP handler chain.
func NewMux(store *Store, rl *RateLimiter) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/_health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("GET /api/stats/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !slugRe.MatchString(slug) {
			http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
			return
		}
		views, likes, err := store.Stats(slug)
		if err != nil {
			log.Printf("stats slug=%q err=%v", slug, err)
			http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=30")
		writeJSON(w, map[string]int64{"views": views, "likes": likes})
	})
	mux.HandleFunc("POST /api/view/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !slugRe.MatchString(slug) {
			http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
			return
		}
		ip := clientIP(r)
		if !rl.AllowPost(ip) {
			http.Error(w, `{"error":"rate limit"}`, http.StatusTooManyRequests)
			return
		}
		if isBot(r) || !rl.AllowView(ip, slug) {
			// Silently no-op: return current value, status 200.
			views, _, _ := store.Stats(slug)
			writeJSON(w, map[string]int64{"views": views})
			return
		}
		views, err := store.IncrView(slug)
		if err != nil {
			log.Printf("incrview slug=%q err=%v", slug, err)
			http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]int64{"views": views})
	})
	mux.HandleFunc("POST /api/like/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !slugRe.MatchString(slug) {
			http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
			return
		}
		ip := clientIP(r)
		if !rl.AllowPost(ip) {
			http.Error(w, `{"error":"rate limit"}`, http.StatusTooManyRequests)
			return
		}
		if !rl.AllowLike(ip, slug) {
			http.Error(w, `{"error":"already liked"}`, http.StatusTooManyRequests)
			return
		}
		likes, err := store.IncrLike(slug)
		if err != nil {
			log.Printf("incrlike slug=%q err=%v", slug, err)
			http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]int64{"likes": likes})
	})
	return cors(recoverer(mux))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if p := recover(); p != nil {
				log.Printf("panic: %v path=%s", p, r.URL.Path)
				if !errors.Is(r.Context().Err(), nil) {
					return
				}
				http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// clientIP trusts X-Forwarded-For from Caddy (single hop on loopback).
// In production traffic passes Caddy -> 127.0.0.1:8787, so X-F-F is set by Caddy.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// First entry is the originator.
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func isBot(r *http.Request) bool {
	ua := r.Header.Get("User-Agent")
	if botUARe.MatchString(ua) {
		return true
	}
	// Naïve scrapers often miss Sec-Fetch-Site AND don't claim Mozilla.
	if r.Header.Get("Sec-Fetch-Site") == "" && !strings.Contains(ua, "Mozilla/") {
		return true
	}
	return false
}
