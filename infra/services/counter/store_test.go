package main

import (
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := OpenStore(":memory:")
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestStore_StatsUnknownSlugReturnsZeros(t *testing.T) {
	s := newTestStore(t)
	views, likes, err := s.Stats("never-seen")
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if views != 0 || likes != 0 {
		t.Fatalf("want (0,0), got (%d,%d)", views, likes)
	}
}

func TestStore_IncrViewCreatesRowAndIncrements(t *testing.T) {
	s := newTestStore(t)
	v1, err := s.IncrView("post-a")
	if err != nil || v1 != 1 {
		t.Fatalf("first IncrView: got %d err=%v", v1, err)
	}
	v2, err := s.IncrView("post-a")
	if err != nil || v2 != 2 {
		t.Fatalf("second IncrView: got %d err=%v", v2, err)
	}
	views, likes, _ := s.Stats("post-a")
	if views != 2 || likes != 0 {
		t.Fatalf("Stats after 2 views: got (%d,%d) want (2,0)", views, likes)
	}
}

func TestStore_IncrLikeIndependentOfViews(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.IncrView("post-b"); err != nil {
		t.Fatalf("IncrView: %v", err)
	}
	l, err := s.IncrLike("post-b")
	if err != nil || l != 1 {
		t.Fatalf("IncrLike: got %d err=%v", l, err)
	}
	views, likes, _ := s.Stats("post-b")
	if views != 1 || likes != 1 {
		t.Fatalf("Stats: got (%d,%d) want (1,1)", views, likes)
	}
}

func TestStore_DistinctSlugsAreIsolated(t *testing.T) {
	s := newTestStore(t)
	s.IncrView("a")
	s.IncrView("a")
	s.IncrLike("b")
	va, la, _ := s.Stats("a")
	vb, lb, _ := s.Stats("b")
	if va != 2 || la != 0 {
		t.Fatalf("a: got (%d,%d) want (2,0)", va, la)
	}
	if vb != 0 || lb != 1 {
		t.Fatalf("b: got (%d,%d) want (0,1)", vb, lb)
	}
}
