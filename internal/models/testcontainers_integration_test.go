package models

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	tc "github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	_ "github.com/go-sql-driver/mysql"
)

var testDB *sql.DB

// käyttämällä testcontainers kirjastoa, saadaan luotua testitietokanta
// dockerilla samoista scripteistä kuin palvelun tietokantakin luodaan.
func TestMain(m *testing.M) {
	ctx := context.Background()

	_, thisFile, _, _ := runtime.Caller(0)
	thisDir := filepath.Dir(thisFile)
	projectRoot := filepath.Dir(filepath.Dir(thisDir))
	sqlScriptsHostPath := filepath.Join(projectRoot, "mariadb-docker", "sql-scripts")

	if fi, err := os.Stat(sqlScriptsHostPath); err != nil || !fi.IsDir() {
		if alt := os.Getenv("DB_INIT_SCRIPTS_DIR"); alt != "" {
			sqlScriptsHostPath = alt
		} else {
			sqlScriptsHostPath = ""
		}
	}

	mariadbUser := "testuser"
	mariadbPass := "testpass"
	mariadbDB := "fullstack_project"
	mariadbRoot := "rootpass"
	image := "mariadb:10.6"

	req := tc.ContainerRequest{
		Image: image,
		Env: map[string]string{
			"MARIADB_ROOT_PASSWORD": mariadbRoot,
			"MARIADB_DATABASE":      mariadbDB,
			"MARIADB_USER":          mariadbUser,
			"MARIADB_PASSWORD":      mariadbPass,
		},
		ExposedPorts: []string{"3306/tcp"},
		WaitingFor:   wait.ForListeningPort("3306/tcp").WithStartupTimeout(60 * time.Second),
	}

	if sqlScriptsHostPath != "" {
		req.Binds = append(req.Binds, "/docker-entrypoint-initdb.d")
	}

	container, err := tc.GenericContainer(ctx, tc.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to start mariadb container: %v\n", err)
		os.Exit(1)
	}

	defer func() { _ = container.Terminate(ctx) }()

	host, err := container.Host(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get container host: %v\n", err)
		_ = container.Terminate(ctx)
		os.Exit(1)
	}
	mappedPort, err := container.MappedPort(ctx, "3306/tcp")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get mapped port: %v\n", err)
		_ = container.Terminate(ctx)
		os.Exit(1)
	}

	os.Setenv("DB_TEST_USER", mariadbUser)
	os.Setenv("DB_TEST_PASS", mariadbPass)
	os.Setenv("DB_TEST_NAME", mariadbDB)
	os.Setenv("DB_TEST_PORT", mappedPort.Port())
	os.Setenv("DB_TEST_HOST", host)
	os.Setenv("DB_TEST_ROOT_PASS", mariadbRoot)

	rootDSN := fmt.Sprintf("root:%s@tcp(%s:%s)/%s?parseTime=true&multiStatements=true", mariadbRoot, host, mappedPort.Port(), mariadbDB)
	rootDB, err := sql.Open("mysql", rootDSN)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open root db: %v\n", err)
		_ = container.Terminate(ctx)
		os.Exit(1)
	}

	deadline := time.Now().Add(45 * time.Second)
	for {
		if err := rootDB.Ping(); err == nil {
			break
		}
		if time.Now().After(deadline) {
			rootDB.Close()
			fmt.Fprintf(os.Stderr, "root database did not become ready: %v\n", err)
			_ = container.Terminate(ctx)
			os.Exit(1)
		}
		time.Sleep(300 * time.Millisecond)
	}

	if sqlScriptsHostPath != "" {
		if err := execSQLFilesAgainstDB(rootDB, sqlScriptsHostPath); err != nil {
			fmt.Fprintf(os.Stderr, "failed to run init SQL files as root: %v\n", err)
			if logs, lerr := container.Logs(ctx); lerr == nil {
				io.Copy(os.Stderr, logs)
			}
			_ = rootDB.Close()
			_ = container.Terminate(ctx)
			os.Exit(1)
		}
	}

	_ = rootDB.Close()

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&multiStatements=true", mariadbUser, mariadbPass, host, mappedPort.Port(), mariadbDB)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open test db: %v\n", err)
		_ = container.Terminate(ctx)
		os.Exit(1)
	}

	deadline = time.Now().Add(15 * time.Second)
	for {
		if err := db.Ping(); err == nil {
			break
		}
		if time.Now().After(deadline) {
			db.Close()
			fmt.Fprintf(os.Stderr, "test database did not become ready: %v\n", err)
			_ = container.Terminate(ctx)
			os.Exit(1)
		}
		time.Sleep(200 * time.Millisecond)
	}

	testDB = db

	code := m.Run()

	if testDB != nil {
		_ = testDB.Close()
	}
	if err := container.Terminate(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "failed to terminate container: %v\n", err)
	}

	os.Exit(code)
}

func getTestDB(t *testing.T) *sql.DB {
	if testDB == nil {
		t.Fatal("test DB not initialized; ensure TestMain started the container")
	}
	return testDB
}

func splitSQLStatements(src string) []string {
	var stmts []string
	delimiter := ";"
	var buf strings.Builder

	lines := strings.Split(strings.ReplaceAll(src, "\r\n", "\n"), "\n")

	flushBuf := func() {
		s := strings.TrimSpace(buf.String())
		if s != "" {
			stmts = append(stmts, s)
		}
		buf.Reset()
	}

	for _, line := range lines {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(strings.ToUpper(trim), "DELIMITER ") {
			flushBuf()
			parts := strings.SplitN(trim, " ", 2)
			if len(parts) == 2 {
				delimiter = parts[1]
			} else {
				delimiter = ";"
			}
			continue
		}

		buf.WriteString(line)
		buf.WriteString("\n")

		if strings.HasSuffix(strings.TrimSpace(buf.String()), delimiter) {
			full := strings.TrimSpace(buf.String())
			stmt := strings.TrimSpace(full[:len(full)-len(delimiter)])
			if stmt != "" {
				stmts = append(stmts, stmt)
			}
			buf.Reset()
		}
	}

	flushBuf()
	return stmts
}

func execSQLFilesAgainstDB(db *sql.DB, dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read dir %s: %w", dir, err)
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if strings.HasSuffix(strings.ToLower(e.Name()), ".sql") {
			files = append(files, filepath.Join(dir, e.Name()))
		}
	}
	sort.Strings(files)

	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			return fmt.Errorf("read file %s: %w", f, err)
		}
		src := string(b)
		stmts := splitSQLStatements(src)
		for i, s := range stmts {
			if strings.TrimSpace(s) == "" {
				continue
			}
			if _, err := db.Exec(s); err != nil {
				return fmt.Errorf("exec %s (statement %d): %w", f, i+1, err)
			}
		}
	}
	return nil
}
