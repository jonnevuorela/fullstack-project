package main

import (
	"errors"
	"fmt"

	"net/http"

	"fullstack-project.jonnevuorela.com/internal/models"
	"fullstack-project.jonnevuorela.com/internal/validator"
)

type userSignupForm struct {
	Username            string `form:"username"`
	Email               string `form:"email"`
	Password            string `form:"password"`
	validator.Validator `form:"-"`
}

type userLoginForm struct {
	Username            string `form:"username"`
	Password            string `form:"password"`
	validator.Validator `form:"-"`
}

func (app *application) home(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)

	app.render(writer, http.StatusOK, "home.tmpl", data)
}

func (app *application) userSignup(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)
	data.Form = userSignupForm{}
	app.render(writer, http.StatusOK, "signup.tmpl", data)
}

func (app *application) userSignupPost(writer http.ResponseWriter, request *http.Request) {
	var form userSignupForm
	err := app.decodePostForm(request, &form)
	if err != nil {
		app.clientError(writer, http.StatusBadRequest)
		return
	}

	form.CheckField(validator.NotBlank(form.Username), "username", "This field cannot be blank")
	if validator.NotBlank(form.Email) {
		form.CheckField(validator.Matches(form.Email, validator.EmailRX), "email", "This field must be a valid email address")
	}
	form.CheckField(validator.NotBlank(form.Password), "password", "This field cannot be blank")
	form.CheckField(validator.MinChars(form.Password, 8), "password", "This field must be at least 8 characters long")

	if !form.Valid() {
		data := app.newTemplateData(request)
		data.Form = form
		app.render(writer, http.StatusUnprocessableEntity, "signup.tmpl", data)
		return
	}

	userId, err := app.users.Insert(form.Username, form.Email, form.Password)
	if err != nil {
		if errors.Is(err, models.ErrDuplicateUsername) {
			form.AddFieldError("username", "Username is already in use")
			data := app.newTemplateData(request)
			data.Form = form
			app.render(writer, http.StatusUnprocessableEntity, "signup.tmpl", data)
		} else {
			app.serverError(writer, err)
			app.sessionManager.Put(request.Context(), "flash", fmt.Sprintf("Error in signup %v", err))
		}
		return
	}

	defaultTune := models.NewTune()
	tuneID, err := app.tunes.Insert(defaultTune)
	if err != nil {
		app.serverError(writer, err)
	} else if tuneID != nil {
		if err := app.users.UpdateSavedTune(userId, *tuneID); err != nil {
			app.serverError(writer, err)
		}
	}
	app.sessionManager.Put(request.Context(), "flash", "Your signup was successful. Plese log in.")

	http.Redirect(writer, request, "/user/login", http.StatusSeeOther)

}

func (app *application) userLogin(writer http.ResponseWriter, request *http.Request) {
	data := app.newTemplateData(request)
	data.Form = userLoginForm{}
	app.render(writer, http.StatusOK, "login.tmpl", data)
}

func (app *application) userLoginPost(writer http.ResponseWriter, request *http.Request) {
	var form userLoginForm

	err := app.decodePostForm(request, &form)
	if err != nil {
		app.clientError(writer, http.StatusBadRequest)
		return
	}

	form.CheckField(validator.NotBlank(form.Username), "username", "This field cannot be blank")
	form.CheckField(validator.NotBlank(form.Password), "password", "This field cannot be blank")

	if !form.Valid() {
		data := app.newTemplateData(request)
		data.Form = form
		app.render(writer, http.StatusUnprocessableEntity, "login.tmpl", data)
		return
	}

	id, err := app.users.Authenticate(form.Username, form.Password)
	if err != nil {
		if errors.Is(err, models.ErrInvalidCredentials) {
			form.AddNonFieldError("Email or password is incorrect")

			data := app.newTemplateData(request)
			data.Form = form
			app.render(writer, http.StatusUnprocessableEntity, "login.tmpl", data)
		} else {
			app.serverError(writer, err)
		}
		return
	}

	err = app.sessionManager.RenewToken(request.Context())
	if err != nil {
		app.serverError(writer, err)
		return
	}

	app.sessionManager.Put(request.Context(), "authenticatedUserId", id)

	http.Redirect(writer, request, "/", http.StatusSeeOther)
}

func (app *application) userLogoutPost(writer http.ResponseWriter, request *http.Request) {
	err := app.sessionManager.RenewToken(request.Context())
	if err != nil {
		app.serverError(writer, err)
		return
	}

	app.sessionManager.Remove(request.Context(), "authenticatedUserId")

	app.sessionManager.Put(request.Context(), "flash", "You've been logged out successfully!")

	http.Redirect(writer, request, "/", http.StatusSeeOther)
}

func ping(writer http.ResponseWriter, request *http.Request) {
	writer.Write([]byte("OK"))
}
