package main

import (
	"testing"
	"time"
)

func TestTokenBucket_AllowsBurstThenRejects(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock) // 30 tokens / minute / IP

	for i := 0; i < 30; i++ {
		if !rl.AllowPost("1.2.3.4") {
			t.Fatalf("hit %d: expected allow", i+1)
		}
	}
	if rl.AllowPost("1.2.3.4") {
		t.Fatalf("31st hit must be denied")
	}
}

func TestTokenBucket_RefillsOverTime(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	for i := 0; i < 30; i++ {
		rl.AllowPost("ip")
	}
	if rl.AllowPost("ip") {
		t.Fatalf("expected denied at bucket empty")
	}
	now = now.Add(30 * time.Second) // half-refill
	if !rl.AllowPost("ip") {
		t.Fatalf("expected refill after 30s to provide at least one token")
	}
}

func TestViewDedup_BlocksRepeatWithinWindow(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	if !rl.AllowView("ip", "post-x") {
		t.Fatalf("first view must allow")
	}
	if rl.AllowView("ip", "post-x") {
		t.Fatalf("second view within window must block")
	}
	if !rl.AllowView("ip", "other-post") {
		t.Fatalf("same IP different post must allow")
	}
}

func TestViewDedup_AllowsAfterWindow(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	rl.AllowView("ip", "post-x")
	now = now.Add(31 * time.Minute)
	if !rl.AllowView("ip", "post-x") {
		t.Fatalf("view after 30min must allow again")
	}
}

func TestLikeDedup_OneShotPerIPSlug(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	if !rl.AllowLike("ip", "post-x") {
		t.Fatalf("first like must allow")
	}
	if rl.AllowLike("ip", "post-x") {
		t.Fatalf("second like must block")
	}
	now = now.Add(24 * time.Hour) // even after a day
	if rl.AllowLike("ip", "post-x") {
		t.Fatalf("like dedup must persist for process lifetime")
	}
}

func TestRateLimiter_LRUEviction(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 3, clock) // tiny cap

	rl.AllowPost("a")
	rl.AllowPost("b")
	rl.AllowPost("c")
	rl.AllowPost("d") // should evict "a"
	if got := rl.bucketsLen(); got > 3 {
		t.Fatalf("expected <=3 buckets after eviction, got %d", got)
	}
}
