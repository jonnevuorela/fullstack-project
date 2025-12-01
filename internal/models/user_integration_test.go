package models

import (
	"database/sql"
	"testing"

	"fullstack-project.jonnevuorela.com/internal/assert"

	"golang.org/x/crypto/bcrypt"
)

/// Integraatio testit user model interfacen funktioille testitietokantaa vasten.

func cleanupUsers(t *testing.T, db *sql.DB) {
	t.Helper()
	if _, err := db.Exec("DELETE FROM users"); err != nil {
		t.Fatalf("cleanup users: %v", err)
	}
	if _, err := db.Exec("ALTER TABLE users AUTO_INCREMENT = 1"); err != nil {
		t.Fatalf("reset auto_increment: %v", err)
	}
}

func TestUser_InsertAndGet(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupUsers(t, db)
	t.Cleanup(func() { cleanupUsers(t, db) })

	um := &UserModel{DB: db}

	username := "testuser"
	email := "test@example.com"
	password := "testpass"

	id, err := um.Insert(username, email, password)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	got, err := um.Get(id)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}

	assert.Equal(t, got.Username, username)
	assert.Equal(t, got.Email, email)
	err = bcrypt.CompareHashAndPassword(got.HashedPassword, []byte(password))
	assert.NilError(t, err)
}

func TestUser_InsertDuplicateUsername_ReturnsError(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupUsers(t, db)
	t.Cleanup(func() { cleanupUsers(t, db) })

	um := &UserModel{DB: db}

	username := "dupuser"
	email := "dup@example.com"
	password := "pass"

	_, err := um.Insert(username, email, password)
	if err != nil {
		t.Fatalf("first Insert failed: %v", err)
	}

	_, err = um.Insert(username, "other@example.com", password)
	if err == nil {
		t.Fatal("expected duplicate insert to fail")
	}
	assert.Equal(t, err, ErrDuplicateUsername)
}

func TestUser_Get_NonExistent(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupUsers(t, db)
	t.Cleanup(func() { cleanupUsers(t, db) })

	um := &UserModel{DB: db}

	got, err := um.Get(999)
	assert.ErrorIs(t, err, sql.ErrNoRows)
	assert.Nil(t, got)
}

func TestUser_Authenticate(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupUsers(t, db)
	t.Cleanup(func() { cleanupUsers(t, db) })

	um := &UserModel{DB: db}

	username := "authuser"
	email := "auth@example.com"
	password := "authpass"

	insertedId, err := um.Insert(username, email, password)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	id, err := um.Authenticate(username, password)
	if err != nil {
		t.Fatalf("Authenticate failed: %v", err)
	}
	assert.Equal(t, id, insertedId)

	_, err = um.Authenticate(username, "wrongpass")
	assert.Equal(t, err, ErrInvalidCredentials)

	_, err = um.Authenticate("nonuser", password)
	assert.Equal(t, err, ErrInvalidCredentials)
}

func TestUser_Exists(t *testing.T) {
	if testing.Short() {
		t.Skip("integration: skipping DB test")
	}
	db := getTestDB(t)
	cleanupUsers(t, db)
	t.Cleanup(func() { cleanupUsers(t, db) })

	um := &UserModel{DB: db}

	username := "existuser"
	email := "exist@example.com"
	password := "existpass"

	id, err := um.Insert(username, email, password)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	exists, err := um.Exists(id)
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	assert.Equal(t, exists, true)

	exists, err = um.Exists(999)
	if err != nil {
		t.Fatalf("Exists failed: %v", err)
	}
	assert.Equal(t, exists, false)
}
