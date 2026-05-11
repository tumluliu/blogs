package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func newTestServer(t *testing.T) (*httptest.Server, *Store) {
	t.Helper()
	s, err := OpenStore(":memory:")
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	clock := func() time.Time { return time.Now() }
	rl := NewRateLimiter(30, time.Minute, 1000, clock)
	mux := NewMux(s, rl)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, s
}

func do(t *testing.T, method, url string, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest(method, url, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	// Default UA so bot filter doesn't drop normal-looking requests.
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0")
	}
	if req.Header.Get("Sec-Fetch-Site") == "" {
		req.Header.Set("Sec-Fetch-Site", "same-origin")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	return resp, body
}

func TestHandler_StatsUnknownSlug(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := do(t, "GET", srv.URL+"/api/stats/never-seen", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d body=%s", resp.StatusCode, body)
	}
	var got struct{ Views, Likes int64 }
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("decode: %v body=%s", err, body)
	}
	if got.Views != 0 || got.Likes != 0 {
		t.Fatalf("got %+v want zeros", got)
	}
}

func TestHandler_ViewIncrementsThenStatsReflects(t *testing.T) {
	srv, _ := newTestServer(t)
	for i := 0; i < 3; i++ {
		// Different IPs via X-Forwarded-For to bypass view-dedup per-IP.
		_, _ = do(t, "POST", srv.URL+"/api/view/post-a", map[string]string{
			"X-Forwarded-For": ipN(i),
		})
	}
	resp, body := do(t, "GET", srv.URL+"/api/stats/post-a", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d body=%s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), `"views":3`) {
		t.Fatalf("expected views:3 got %s", body)
	}
}

func TestHandler_ViewDedupSameIP(t *testing.T) {
	srv, _ := newTestServer(t)
	h := map[string]string{"X-Forwarded-For": "9.9.9.9"}
	do(t, "POST", srv.URL+"/api/view/post-x", h)
	do(t, "POST", srv.URL+"/api/view/post-x", h)
	do(t, "POST", srv.URL+"/api/view/post-x", h)
	_, body := do(t, "GET", srv.URL+"/api/stats/post-x", nil)
	if !strings.Contains(string(body), `"views":1`) {
		t.Fatalf("expected views:1 (dedup) got %s", body)
	}
}

func TestHandler_LikeDedupSameIPReturns429(t *testing.T) {
	srv, _ := newTestServer(t)
	h := map[string]string{"X-Forwarded-For": "8.8.8.8"}
	r1, _ := do(t, "POST", srv.URL+"/api/like/post-y", h)
	r2, _ := do(t, "POST", srv.URL+"/api/like/post-y", h)
	if r1.StatusCode != 200 {
		t.Fatalf("first like status %d want 200", r1.StatusCode)
	}
	if r2.StatusCode != 429 {
		t.Fatalf("second like status %d want 429", r2.StatusCode)
	}
}

func TestHandler_BotUAFilterDropsView(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := do(t, "POST", srv.URL+"/api/view/post-b", map[string]string{
		"User-Agent":      "Mozilla/5.0 (compatible; Googlebot/2.1)",
		"X-Forwarded-For": "7.7.7.7",
	})
	if resp.StatusCode != 200 {
		t.Fatalf("bot view status %d want 200 (silently dropped)", resp.StatusCode)
	}
	_, body := do(t, "GET", srv.URL+"/api/stats/post-b", nil)
	if !strings.Contains(string(body), `"views":0`) {
		t.Fatalf("expected views:0 (bot dropped) got %s", body)
	}
}

func TestHandler_BadSlugReturns400(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := do(t, "POST", srv.URL+"/api/view/..%2Fetc%2Fpasswd", nil)
	if resp.StatusCode != 400 {
		t.Fatalf("traversal slug status %d want 400", resp.StatusCode)
	}
	bigSlug := strings.Repeat("a", 250)
	resp2, _ := do(t, "POST", srv.URL+"/api/view/"+bigSlug, nil)
	if resp2.StatusCode != 400 {
		t.Fatalf("oversize slug status %d want 400", resp2.StatusCode)
	}
}

func TestHandler_CJKSlugAccepted(t *testing.T) {
	srv, _ := newTestServer(t)
	// /api/view/中文slug
	resp, _ := do(t, "POST", srv.URL+"/api/view/%E4%B8%AD%E6%96%87slug", map[string]string{
		"X-Forwarded-For": "4.4.4.4",
	})
	if resp.StatusCode != 200 {
		t.Fatalf("cjk slug status %d want 200", resp.StatusCode)
	}
}

func TestHandler_CORSHeadersOnOptions(t *testing.T) {
	srv, _ := newTestServer(t)
	req, _ := http.NewRequest("OPTIONS", srv.URL+"/api/view/x", nil)
	req.Header.Set("Origin", "https://luliu.me")
	req.Header.Set("Access-Control-Request-Method", "POST")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != 204 {
		t.Fatalf("OPTIONS status %d want 204", resp.StatusCode)
	}
	if resp.Header.Get("Access-Control-Allow-Origin") != "https://luliu.me" {
		t.Fatalf("CORS origin header: %q", resp.Header.Get("Access-Control-Allow-Origin"))
	}
}

func TestHandler_Health(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := do(t, "GET", srv.URL+"/api/_health", nil)
	if resp.StatusCode != 200 || strings.TrimSpace(string(body)) != "ok" {
		t.Fatalf("health: status=%d body=%q", resp.StatusCode, body)
	}
}

func TestHandler_StatsCacheHeader(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := do(t, "GET", srv.URL+"/api/stats/anything", nil)
	if got := resp.Header.Get("Cache-Control"); got != "public, max-age=30" {
		t.Fatalf("Cache-Control: %q", got)
	}
}

func TestHandler_ConcurrentLikesFromDistinctIPs(t *testing.T) {
	srv, _ := newTestServer(t)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			do(t, "POST", srv.URL+"/api/like/concurrent-post", map[string]string{
				"X-Forwarded-For": ipN(i),
			})
		}(i)
	}
	wg.Wait()
	_, body := do(t, "GET", srv.URL+"/api/stats/concurrent-post", nil)
	if !strings.Contains(string(body), `"likes":100`) {
		t.Fatalf("want likes:100 got %s", body)
	}
}

func ipN(i int) string {
	return "10.0." + itoa(i/256) + "." + itoa(i%256)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var s string
	for i > 0 {
		s = string(rune('0'+i%10)) + s
		i /= 10
	}
	return s
}
