package main

import (
	"container/list"
	"sync"
	"time"
)

type bucket struct {
	tokens float64
	last   time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	capacity float64
	per      time.Duration
	maxKeys  int
	now      func() time.Time

	postBuckets map[string]*bucket
	viewSeen    map[string]time.Time // key = ip + "|" + slug
	likeSeen    map[string]struct{}  // key = ip + "|" + slug, ever

	// LRU tracking for postBuckets only (most numerous).
	lru      *list.List
	elements map[string]*list.Element
}

const viewDedupWindow = 30 * time.Minute

func NewRateLimiter(capacity int, per time.Duration, maxKeys int, now func() time.Time) *RateLimiter {
	return &RateLimiter{
		capacity:    float64(capacity),
		per:         per,
		maxKeys:     maxKeys,
		now:         now,
		postBuckets: make(map[string]*bucket),
		viewSeen:    make(map[string]time.Time),
		likeSeen:    make(map[string]struct{}),
		lru:         list.New(),
		elements:    make(map[string]*list.Element),
	}
}

// AllowPost consumes one token from the IP's bucket. Returns false when empty.
func (r *RateLimiter) AllowPost(ip string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	b := r.getBucket(ip)
	now := r.now()
	elapsed := now.Sub(b.last).Seconds()
	refill := elapsed * r.capacity / r.per.Seconds()
	b.tokens += refill
	if b.tokens > r.capacity {
		b.tokens = r.capacity
	}
	b.last = now
	if b.tokens < 1.0 {
		return false
	}
	b.tokens -= 1.0
	return true
}

// AllowView returns true if this (ip, slug) view is fresh enough to count.
func (r *RateLimiter) AllowView(ip, slug string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := ip + "|" + slug
	last, ok := r.viewSeen[key]
	now := r.now()
	if ok && now.Sub(last) < viewDedupWindow {
		return false
	}
	r.viewSeen[key] = now
	return true
}

// AllowLike returns true exactly once per (ip, slug) per process lifetime.
func (r *RateLimiter) AllowLike(ip, slug string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := ip + "|" + slug
	if _, seen := r.likeSeen[key]; seen {
		return false
	}
	r.likeSeen[key] = struct{}{}
	return true
}

// bucketsLen is for tests only.
func (r *RateLimiter) bucketsLen() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.postBuckets)
}

func (r *RateLimiter) getBucket(ip string) *bucket {
	if el, ok := r.elements[ip]; ok {
		r.lru.MoveToFront(el)
		return r.postBuckets[ip]
	}
	if r.lru.Len() >= r.maxKeys {
		oldest := r.lru.Back()
		if oldest != nil {
			oldKey := oldest.Value.(string)
			r.lru.Remove(oldest)
			delete(r.elements, oldKey)
			delete(r.postBuckets, oldKey)
		}
	}
	b := &bucket{tokens: r.capacity, last: r.now()}
	r.postBuckets[ip] = b
	r.elements[ip] = r.lru.PushFront(ip)
	return b
}
