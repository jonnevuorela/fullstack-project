package main

import (
	"bytes"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/go-playground/form/v4"
	"github.com/justinas/nosurf"
)

func (app *application) isAuthenticated(request *http.Request) bool {
	isAuthenticated, ok := request.Context().Value(isAuthenticatedContextKey).(bool)
	if !ok {
		return false
	}
	return isAuthenticated
}
func (app *application) serverError(w http.ResponseWriter, err error) {
	trace := fmt.Sprintf("%s\n%s", err.Error(), debug.Stack())
	app.errorLog.Output(2, trace)

	http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
}

func (app *application) clientError(w http.ResponseWriter, status int) {
	http.Error(w, http.StatusText(status), status)
}

func (app *application) notFound(w http.ResponseWriter) {
	app.clientError(w, http.StatusNotFound)
}

func (app *application) render(w http.ResponseWriter, status int, page string, data *templateData) {
	ts, ok := app.templateCache[page]
	if !ok {
		err := fmt.Errorf("the template %s does not exist", page)
		app.serverError(w, err)
		return
	}

	buf := new(bytes.Buffer)

	err := ts.ExecuteTemplate(buf, "base", data)
	if err != nil {
		app.serverError(w, err)
	}

	w.WriteHeader(status)

	buf.WriteTo(w)
}

func (app *application) decodePostForm(r *http.Request, dst any) error {
	err := r.ParseForm()
	if err != nil {
		return err
	}

	err = app.formDecoder.Decode(dst, r.PostForm)
	if err != nil {
		var invaliDecoderError *form.InvalidDecoderError

		if errors.As(err, &invaliDecoderError) {
			panic(err)
		}

		return err
	}

	return nil

}

func (app *application) newTemplateData(r *http.Request) *templateData {
	nonce, _ := r.Context().Value("nonce").(string)
	id := app.sessionManager.Get(r.Context(), "authenticatedUserId")
	var resolvedId int

	// varmennetaan id:n tyyppi ja generoidaan vieras id jos käyttäjä ei ole kirjautunut
	if id == nil {
		guestId := app.sessionManager.Get(r.Context(), "guestUserId")
		if  guestId == nil{
			valid_id := false
			var num int
			for !valid_id{
				num = rand.Int()
				duplicate, err := app.users.Exists(num)
				if err != nil{
					app.errorLog.Print(err)
					continue
				}
				if !duplicate && num != 0 {
					valid_id = true
				}
			}
			resolvedId = num
			app.infoLog.Printf("Random guest id generated: %v", resolvedId)
			app.sessionManager.Put(r.Context(), "guestUserId", resolvedId)
		}else{
			if gId, ok := guestId.(int); ok{
				resolvedId = gId
			}else {
				app.errorLog.Printf("Invalid guest id type: %T", guestId)
				resolvedId = 0
			}
		}
    }else {
		if authId, ok := id.(int); ok {
			resolvedId = authId
		}else{
			app.errorLog.Printf("Invalid authenticated id type: %T", authId)
			resolvedId = 0
		}
	}
	app.infoLog.Printf("userId: %v", resolvedId)

	return &templateData{
		CurrentYear: time.Now().Year(),
		Flash:       app.sessionManager.PopString(r.Context(), "flash"),
		CSRFToken:   nosurf.Token(r),
		PlayerID:    resolvedId,
		Nonce:       nonce,

		IsAuthenticated: app.isAuthenticated(r),
	}
}
