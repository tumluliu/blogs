package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	addr := os.Getenv("COUNTER_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
	}
	dsn := os.Getenv("COUNTER_DB")
	if dsn == "" {
		dsn = "counter.db"
	}

	store, err := OpenStore(dsn)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer store.Close()

	rl := NewRateLimiter(30, time.Minute, 10_000, time.Now)
	mux := NewMux(store, rl)

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadTimeout:       5 * time.Second,
		ReadHeaderTimeout: 3 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		log.Printf("counter listening on %s db=%s", addr, dsn)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Print("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
