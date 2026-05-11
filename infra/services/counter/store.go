package main

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func OpenStore(dsn string) (*Store, error) {
	// modernc driver name is "sqlite"; "?_pragma=…" sets pragmas at open time.
	connStr := dsn + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(2000)&_pragma=synchronous(NORMAL)"
	if dsn == ":memory:" {
		// in-memory DB can't be WAL, drop that pragma
		connStr = dsn
	}
	db, err := sql.Open("sqlite", connStr)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(1) // SQLite single-writer; serialise everything.
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS counters (
			slug       TEXT PRIMARY KEY,
			views      INTEGER NOT NULL DEFAULT 0,
			likes      INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL
		);
	`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create table: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Stats(slug string) (views, likes int64, err error) {
	row := s.db.QueryRow(`SELECT views, likes FROM counters WHERE slug = ?`, slug)
	if err := row.Scan(&views, &likes); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("stats: %w", err)
	}
	return views, likes, nil
}

func (s *Store) IncrView(slug string) (int64, error) {
	return s.incr(slug, 1, 0)
}

func (s *Store) IncrLike(slug string) (int64, error) {
	return s.incr(slug, 0, 1)
}

func (s *Store) incr(slug string, dViews, dLikes int64) (int64, error) {
	now := time.Now().Unix()
	_, err := s.db.Exec(`
		INSERT INTO counters(slug, views, likes, updated_at)
		VALUES(?, ?, ?, ?)
		ON CONFLICT(slug) DO UPDATE SET
			views      = views + excluded.views,
			likes      = likes + excluded.likes,
			updated_at = excluded.updated_at
	`, slug, dViews, dLikes, now)
	if err != nil {
		return 0, fmt.Errorf("incr: %w", err)
	}
	var v, l int64
	if err := s.db.QueryRow(`SELECT views, likes FROM counters WHERE slug = ?`, slug).Scan(&v, &l); err != nil {
		return 0, fmt.Errorf("read back: %w", err)
	}
	if dViews > 0 {
		return v, nil
	}
	return l, nil
}
