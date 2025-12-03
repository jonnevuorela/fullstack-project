package main

import (
	"net/http"
	"net/url"
	"testing"

	"fullstack-project.jonnevuorela.com/internal/assert"
)

func Test_application_userSignupPost(t *testing.T) {
	app := newTestApplication(t)
	ts := newTestServer(t, app.routes())
	defer ts.Close()
	_, _, body := ts.get(t, "/user/signup")
	validCSRFToken := extractCSRFToken(t, body)

	const (
		validUsername = "speedy_racer"
		validPassword = "validPa$$word"
		validEmail    = "race@example.com"
		formTag       = "<form action='/user/signup' method='POST' novalidate>"
	)

	tests := []struct {
		name        string
		username    string
		email       string
		password    string
		csrfToken   string
		wantCode    int
		wantFormTag string
	}{
		{
			name:      "Valid submission",
			username:  validUsername,
			email:     validEmail,
			password:  validPassword,
			csrfToken: validCSRFToken,
			wantCode:  http.StatusSeeOther,
		},
		{
			name:      "Invalid CSRF Token",
			username:  validUsername,
			email:     validEmail,
			password:  validPassword,
			csrfToken: "wrongToken",
			wantCode:  http.StatusBadRequest,
		},
		{
			name:        "Empty username",
			username:    "",
			email:       validEmail,
			password:    validPassword,
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Empty email",
			username:    validUsername,
			email:       "",
			password:    validPassword,
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Empty password",
			username:    validUsername,
			email:       validEmail,
			password:    "",
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Invalid email",
			username:    validUsername,
			email:       "race@example.",
			password:    validPassword,
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Short password",
			username:    validUsername,
			email:       validEmail,
			password:    "pa$$",
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Duplicate email",
			username:    validUsername,
			email:       "dupe@example.com",
			password:    validPassword,
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			form := url.Values{}
			form.Add("username", tt.username)
			form.Add("email", tt.email)
			form.Add("password", tt.password)
			form.Add("csrf_token", tt.csrfToken)

			code, _, body := ts.postForm(t, "/user/signup", form)

			assert.Equal(t, code, tt.wantCode)

			if tt.wantFormTag != "" {
				assert.StringContains(t, body, tt.wantFormTag)
			}
		})
	}
}

func Test_application_userLoginPost(t *testing.T) {
	app := newTestApplication(t)
	ts := newTestServer(t, app.routes())
	defer ts.Close()
	_, _, body := ts.get(t, "/user/login")
	validCSRFToken := extractCSRFToken(t, body)

	const (
		validUsername = "user1"
		validPassword = "password"
		formTag       = "<form action='/user/login' method='POST' novalidate>"
	)

	tests := []struct {
		name        string
		username    string
		password    string
		csrfToken   string
		wantCode    int
		wantFormTag string
	}{
		{
			name:      "Valid submission",
			username:  validUsername,
			password:  validPassword,
			csrfToken: validCSRFToken,
			wantCode:  http.StatusSeeOther,
		},
		{
			name:      "Invalid CSRF Token",
			username:  validUsername,
			password:  validPassword,
			csrfToken: "wrongToken",
			wantCode:  http.StatusBadRequest,
		},
		{
			name:        "Empty username",
			username:    "",
			password:    validPassword,
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Empty password",
			username:    validUsername,
			password:    "",
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
		{
			name:        "Wrong password",
			username:    validUsername,
			password:    "pass",
			csrfToken:   validCSRFToken,
			wantCode:    http.StatusUnprocessableEntity,
			wantFormTag: formTag,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			form := url.Values{}
			form.Add("username", tt.username)
			form.Add("password", tt.password)
			form.Add("csrf_token", tt.csrfToken)

			code, _, body := ts.postForm(t, "/user/login", form)

			assert.Equal(t, code, tt.wantCode)

			if tt.wantFormTag != "" {
				assert.StringContains(t, body, tt.wantFormTag)
			}
		})
	}

}
