package models

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"fullstack-project.jonnevuorela.com/internal/assert"

	"github.com/anandvarma/namegen"
)

/// Integraatio testit player model interfacen funktioille testitietokantaa vasten.

func cleanupPlayers(t *testing.T, db *sql.DB) {
	t.Helper()
	if _, err := db.Exec("DELETE FROM players"); err != nil {
		t.Fatalf("cleanup players: %v", err)
	}
}

func TestPlayer_InsertAndGetById(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupPlayers(t, db)
	t.Cleanup(func() { cleanupPlayers(t, db) })

	pm := &PlayerModel{DB: db}

	name_schema := []namegen.DictType{
		namegen.Adjectives,
	}
	ngen := namegen.NewWithDicts(name_schema)
	name := strings.Join([]string{ngen.Get(), "stranger"}, "-")

	p := NewGuestPlayer(1010101010, name)
	if err := pm.Insert(p); err != nil {
		t.Fatalf("Insert of id: %v, name: %v failed: %v", p.Id, p.Name, err)
	}

	got, err := pm.GetById(1010101010)
	if err != nil {
		t.Fatalf("GetById failed: %v", err)
	}

	assert.Equal(t, got.Id, 1010101010)
	assert.Equal(t, got.UserId, 1)
	assert.Equal(t, got.Name, name)
	assert.True(t, time.Since(got.CreateTime) <= time.Minute, "unexpected CreateTime")
}

func TestPlayer_InsertDuplicateID_ReturnsMySQLError(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupPlayers(t, db)
	t.Cleanup(func() { cleanupPlayers(t, db) })

	pm := &PlayerModel{DB: db}

	p := NewGuestPlayer(1111111111, "dup")
	if err := pm.Insert(p); err != nil {
		t.Fatalf("first Insert failed: %v", err)
	}
	// duplicate insert
	err := pm.Insert(p)
	if err == nil {
		t.Fatal("expected duplicate insert to fail")
	}
	assert.MySQLDuplicateKeyError(t, err)
}

func TestPlayer_GetAllActive_ReturnsOnlyRecent(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupPlayers(t, db)
	t.Cleanup(func() { cleanupPlayers(t, db) })

	// active player
	if _, err := db.Exec("INSERT INTO players (id, user_id, player_name, create_time, last_active) VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())", 1, 1, "active"); err != nil {
		t.Fatalf("insert active: %v", err)
	}
	// stale player
	if _, err := db.Exec("INSERT INTO players (id, user_id, player_name, create_time, last_active) VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP() - INTERVAL 2 MINUTE)", 2, 1, "stale"); err != nil {
		t.Fatalf("insert stale: %v", err)
	}

	pm := &PlayerModel{DB: db}
	list, err := pm.GetAllActive()
	if err != nil {
		t.Fatalf("GetAllActive failed: %v", err)
	}
	assert.Equal(t, len(list), 1)
	assert.Equal(t, list[0].Name, "active")
}

func TestPlayer_UpdateActivity_UpdatesLastActive(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupPlayers(t, db)
	t.Cleanup(func() { cleanupPlayers(t, db) })

	if _, err := db.Exec("INSERT INTO players (id, user_id, player_name, create_time, last_active) VALUES (?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP() - INTERVAL 2 MINUTE)", 42, 1, "updatable"); err != nil {
		t.Fatalf("insert: %v", err)
	}

	pm := &PlayerModel{DB: db}

	row := db.QueryRow("SELECT last_active FROM players WHERE id = ?", 42)
	var old time.Time
	if err := row.Scan(&old); err != nil {
		t.Fatalf("select old last_active: %v", err)
	}

	if err := pm.UpdateActivity(42); err != nil {
		t.Fatalf("UpdateActivity failed: %v", err)
	}

	row = db.QueryRow("SELECT last_active FROM players WHERE id = ?", 42)
	var updated time.Time
	if err := row.Scan(&updated); err != nil {
		t.Fatalf("select updated last_active: %v", err)
	}
	assert.True(t, updated.After(old), "expected updated last_active > old")
}
