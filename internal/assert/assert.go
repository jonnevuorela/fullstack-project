package assert

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func NilError(t *testing.T, actual error) {
	t.Helper()

	if actual != nil {
		t.Errorf("got: %v; expected: nil", actual)
	}
}

func Equal[T comparable](t *testing.T, actual, expected T) {
	t.Helper()

	if actual != expected {
		t.Errorf("got: %v; want: %v", actual, expected)
	}
}

func StringContains(t *testing.T, actual, expectedSubstring string) {
	t.Helper()

	if !strings.Contains(actual, expectedSubstring) {
		t.Errorf("got: %q; expected to contain: %q", actual, expectedSubstring)
	}
}

func MySQLDuplicateKeyError(t *testing.T, err error) {
	t.Helper()
	var myErr *mysql.MySQLError
	if !errors.As(err, &myErr) {
		t.Errorf("got: %v; expected: *mysql.MySQLError", err)
		return
	}
	if myErr.Number != 1062 {
		t.Errorf("got: %d (%s); expected: MySQL error 1062 (duplicate key)", myErr.Number, myErr.Message)
	}
}

func ErrorIs(t *testing.T, actual, target error) {
	t.Helper()
	if !errors.Is(actual, target) {
		t.Errorf("got: %v; expected to be: %v", actual, target)
	}
}

func Nil(t *testing.T, actual any) {
	t.Helper()
	if actual == nil {
		return
	}
	if reflect.ValueOf(actual).IsNil() {
		return
	}
	t.Errorf("got: %v; expected: nil", actual)
}

func True(t *testing.T, condition bool, msg string) {
	t.Helper()
	if !condition {
		t.Error(msg)
	}
}
