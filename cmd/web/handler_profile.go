package main

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"fullstack-project.jonnevuorela.com/internal/models"
	"fullstack-project.jonnevuorela.com/internal/validator"

	"github.com/go-sql-driver/mysql"
)

type profileViewData struct {
	User        *models.User
	AccountAge  string
	Tune        *models.Tune
	HasTune     bool
	PlayerID    int
	CurrentYear int
	IsGuest     bool
}

type profileForm struct {
	Username string `form:"username"`
	Email    string `form:"email"`
	Password string `form:"password"`

	WheelRadius                 string `form:"wheel_radius"`
	WheelWidth                  string `form:"wheel_width"`
	WheelOffset                 string `form:"wheel_offset"`
	WheelVerticalOffset         string `form:"wheel_vertical_offset"`
	WheelLongitudalOffset       string `form:"wheel_longitudal_offset"`
	MaxSteeringAngle            string `form:"max_steering_angle"`
	SuspensionLenghtMin         string `form:"suspension_lenght_min"`
	SuspensionLenghtMax         string `form:"suspension_lenght_max"`
	SuspensionPreload           string `form:"suspension_preload"`
	SuspensionDamping           string `form:"suspension_damping"`
	SuspensionStiffeness        string `form:"suspension_stiffness"`
	FrontTyreLateralFriction    string `form:"front_tyre_lateral_friction"`
	FrontTyreLongitudalFriction string `form:"front_tyre_longitudal_friction"`
	RearTyreLateralFriction     string `form:"rear_tyre_lateral_friction"`
	RearTyreLongitudalFriction  string `form:"rear_tyre_longitudal_friction"`
	FourWheelDrive              string `form:"four_wheel_drive"` // "on" or ""
	Antirollbar                 string `form:"antirollbar"`      // "on" or ""
	TorqueSplitRatio            string `form:"torque_split_ratio"`
	DifferentialLimitedSlip     string `form:"differential_limited_slip_ratio"`
	MaxEngineTorque             string `form:"max_engine_torque"`
	ClutchStrenght              string `form:"clutch_strenght"`
	MinRpm                      string `form:"min_rpm"`
	MaxRpm                      string `form:"max_rpm"`
	DamperMass                  string `form:"damper_mass"`
	FlywheelMass                string `form:"flywheel_mass"`
	VehicleMass                 string `form:"vehicle_mass"`

	validator.Validator `form:"-"`
}

func (app *application) profile(w http.ResponseWriter, r *http.Request) {
	td := app.newTemplateData(r)

	userID := app.sessionManager.GetInt(r.Context(), "authenticatedUserId")
	if userID == 0 {
		app.clientError(w, http.StatusUnauthorized)
		return
	}

	user, err := app.users.Get(userID)
	if err != nil {
		app.serverError(w, err)
		return
	}

	accountAge := humanizeDuration(time.Since(user.CreateTime))

	var tune *models.Tune
	hasTune := false
	if user.SavedTune > 0 {
		tune, err = app.tunes.Get(user.SavedTune)
		if err != nil {
			app.errorLog.Printf("error loading tune for user %d: %v", userID, err)
		} else if tune != nil {
			hasTune = true
		}
	}

	view := &profileViewData{
		User:        user,
		AccountAge:  accountAge,
		Tune:        tune,
		HasTune:     hasTune,
		PlayerID:    td.PlayerID,
		CurrentYear: td.CurrentYear,
		IsGuest:     !td.IsAuthenticated,
	}

	td.Form = view

	app.render(w, http.StatusOK, "profile.tmpl", td)
}

func (app *application) profileEdit(w http.ResponseWriter, r *http.Request) {
	td := app.newTemplateData(r)

	userID := app.sessionManager.GetInt(r.Context(), "authenticatedUserId")
	if userID == 0 {
		app.clientError(w, http.StatusUnauthorized)
		return
	}

	user, err := app.users.Get(userID)
	if err != nil {
		app.serverError(w, err)
		return
	}

	form := profileForm{
		Username: user.Username,
		Email:    user.Email,
	}

	if user.SavedTune > 0 {
		tune, err := app.tunes.Get(user.SavedTune)
		if err != nil {
			app.errorLog.Printf("error loading tune for user %d in profileEdit: %v", userID, err)
		} else if tune != nil {
			form.WheelRadius = fmt.Sprintf("%g", tune.WheelRadius)
			form.WheelWidth = fmt.Sprintf("%g", tune.WheelWidth)
			form.WheelOffset = fmt.Sprintf("%g", tune.WheelOffset)
			form.WheelVerticalOffset = fmt.Sprintf("%g", tune.WheelVerticalOffset)
			form.WheelLongitudalOffset = fmt.Sprintf("%g", tune.WheelLongitudalOffset)
			form.MaxSteeringAngle = strconv.Itoa(tune.MaxSteeringAngle)
			form.SuspensionLenghtMin = fmt.Sprintf("%g", tune.SuspensionLenghtMin)
			form.SuspensionLenghtMax = fmt.Sprintf("%g", tune.SuspensionLenghtMax)
			form.SuspensionPreload = fmt.Sprintf("%g", tune.SuspensionPreload)
			form.SuspensionDamping = fmt.Sprintf("%g", tune.SuspensionDamping)
			form.SuspensionStiffeness = fmt.Sprintf("%g", tune.SuspensionStiffeness)
			form.FrontTyreLateralFriction = fmt.Sprintf("%g", tune.FrontTyreLateralFriction)
			form.FrontTyreLongitudalFriction = fmt.Sprintf("%g", tune.FrontTyreLongitudalFriction)
			form.RearTyreLateralFriction = fmt.Sprintf("%g", tune.RearTyreLateralFriction)
			form.RearTyreLongitudalFriction = fmt.Sprintf("%g", tune.RearTyreLongitudalFriction)
			if tune.FourWheelDrive {
				form.FourWheelDrive = "on"
			}
			if tune.Antirollbar {
				form.Antirollbar = "on"
			}
			form.TorqueSplitRatio = fmt.Sprintf("%g", tune.TorqueSplitRatio)
			form.DifferentialLimitedSlip = fmt.Sprintf("%g", tune.DifferentialLimitedSlipRatio)
			form.MaxEngineTorque = fmt.Sprintf("%g", tune.MaxEngineTorque)
			form.ClutchStrenght = fmt.Sprintf("%g", tune.ClutchStrenght)
			form.MinRpm = fmt.Sprintf("%g", tune.MinRpm)
			form.MaxRpm = fmt.Sprintf("%g", tune.MaxRpm)
			form.DamperMass = fmt.Sprintf("%g", tune.DamperMass)
			form.FlywheelMass = fmt.Sprintf("%g", tune.FlywheelMass)
			form.VehicleMass = fmt.Sprintf("%g", tune.VehicleMass)
		}
	}

	td.Form = form
	app.render(w, http.StatusOK, "profile_edit.tmpl", td)
}

func (app *application) profileEditPost(w http.ResponseWriter, r *http.Request) {
	var form profileForm
	if err := app.decodePostForm(r, &form); err != nil {
		app.clientError(w, http.StatusBadRequest)
		return
	}

	form.CheckField(validator.NotBlank(form.Username), "username", "This field cannot be blank")
	if validator.NotBlank(form.Email) {
		form.CheckField(validator.Matches(form.Email, validator.EmailRX), "email", "This field must be a valid email address")
	}
	if validator.NotBlank(form.Password) {
		form.CheckField(validator.MinChars(form.Password, 8), "password", "This field must be at least 8 characters long")
	}

	validateFloat := func(value, field string) {
		if value == "" {
			return
		}
		if _, err := strconv.ParseFloat(value, 64); err != nil {
			form.AddFieldError(field, "Must be a number")
		}
	}
	validateInt := func(value, field string) {
		if value == "" {
			return
		}
		if _, err := strconv.Atoi(value); err != nil {
			form.AddFieldError(field, "Must be an integer number")
		}
	}

	validateFloat(form.WheelRadius, "wheel_radius")
	validateFloat(form.WheelWidth, "wheel_width")
	validateFloat(form.WheelOffset, "wheel_offset")
	validateFloat(form.WheelVerticalOffset, "wheel_vertical_offset")
	validateFloat(form.WheelLongitudalOffset, "wheel_longitudal_offset")
	validateInt(form.MaxSteeringAngle, "max_steering_angle")
	validateFloat(form.SuspensionLenghtMin, "suspension_lenght_min")
	validateFloat(form.SuspensionLenghtMax, "suspension_lenght_max")
	validateFloat(form.SuspensionPreload, "suspension_preload")
	validateFloat(form.SuspensionDamping, "suspension_damping")
	validateFloat(form.SuspensionStiffeness, "suspension_stiffness")
	validateFloat(form.FrontTyreLateralFriction, "front_tyre_lateral_friction")
	validateFloat(form.FrontTyreLongitudalFriction, "front_tyre_longitudal_friction")
	validateFloat(form.RearTyreLateralFriction, "rear_tyre_lateral_friction")
	validateFloat(form.RearTyreLongitudalFriction, "rear_tyre_longitudal_friction")
	validateFloat(form.TorqueSplitRatio, "torque_split_ratio")
	validateFloat(form.DifferentialLimitedSlip, "differential_limited_slip_ratio")
	validateFloat(form.MaxEngineTorque, "max_engine_torque")
	validateFloat(form.ClutchStrenght, "clutch_strenght")
	validateInt(form.MinRpm, "min_rpm")
	validateInt(form.MaxRpm, "max_rpm")
	validateFloat(form.DamperMass, "damper_mass")
	validateFloat(form.FlywheelMass, "flywheel_mass")
	validateFloat(form.VehicleMass, "vehicle_mass")

	if !form.Valid() {
		td := app.newTemplateData(r)
		td.Form = form
		app.render(w, http.StatusUnprocessableEntity, "profile_edit.tmpl", td)
		return
	}

	userID := app.sessionManager.GetInt(r.Context(), "authenticatedUserId")
	if userID == 0 {
		app.clientError(w, http.StatusUnauthorized)
		return
	}

	if err := app.users.Update(userID, form.Username, form.Email, form.Password); err != nil {
		var myErr *mysql.MySQLError
		if errors.As(err, &myErr) && myErr.Number == 1062 {
			form.AddFieldError("username", "Username is already in use")
			td := app.newTemplateData(r)
			td.Form = form
			app.render(w, http.StatusUnprocessableEntity, "profile_edit.tmpl", td)
			return
		}
		app.serverError(w, err)
		return
	}

	user, err := app.users.Get(userID)
	if err != nil {
		app.serverError(w, err)
		return
	}

	var tune models.Tune
	if user.SavedTune > 0 {
		existing, err := app.tunes.Get(user.SavedTune)
		if err != nil {
			app.serverError(w, err)
			return
		}
		if existing != nil {
			tune = *existing
		} else {
			tune = models.NewTune()
		}
	} else {
		tune = models.NewTune()
	}

	tuneProvided := false

	setFloat := func(src string, dest *float64) {
		if src == "" {
			return
		}
		if v, err := strconv.ParseFloat(src, 64); err == nil {
			*dest = v
			tuneProvided = true
		}
	}
	setInt := func(src string, dest *int) {
		if src == "" {
			return
		}
		if v, err := strconv.Atoi(src); err == nil {
			*dest = v
			tuneProvided = true
		}
	}
	setBoolCheckbox := func(src string, dest *bool) {
		if src == "" {
			return
		}
		*dest = true
		tuneProvided = true
	}

	setFloat(form.WheelRadius, &tune.WheelRadius)
	setFloat(form.WheelWidth, &tune.WheelWidth)
	setFloat(form.WheelOffset, &tune.WheelOffset)
	setFloat(form.WheelVerticalOffset, &tune.WheelVerticalOffset)
	setFloat(form.WheelLongitudalOffset, &tune.WheelLongitudalOffset)
	setInt(form.MaxSteeringAngle, &tune.MaxSteeringAngle)
	setFloat(form.SuspensionLenghtMin, &tune.SuspensionLenghtMin)
	setFloat(form.SuspensionLenghtMax, &tune.SuspensionLenghtMax)
	setFloat(form.SuspensionPreload, &tune.SuspensionPreload)
	setFloat(form.SuspensionDamping, &tune.SuspensionDamping)
	setFloat(form.SuspensionStiffeness, &tune.SuspensionStiffeness)
	setFloat(form.FrontTyreLateralFriction, &tune.FrontTyreLateralFriction)
	setFloat(form.FrontTyreLongitudalFriction, &tune.FrontTyreLongitudalFriction)
	setFloat(form.RearTyreLateralFriction, &tune.RearTyreLateralFriction)
	setFloat(form.RearTyreLongitudalFriction, &tune.RearTyreLongitudalFriction)
	setBoolCheckbox(form.FourWheelDrive, &tune.FourWheelDrive)
	setBoolCheckbox(form.Antirollbar, &tune.Antirollbar)
	setFloat(form.TorqueSplitRatio, &tune.TorqueSplitRatio)
	setFloat(form.DifferentialLimitedSlip, &tune.DifferentialLimitedSlipRatio)
	setFloat(form.MaxEngineTorque, &tune.MaxEngineTorque)
	setFloat(form.ClutchStrenght, &tune.ClutchStrenght)
	setFloat(form.MinRpm, &tune.MinRpm)
	setFloat(form.MaxRpm, &tune.MaxRpm)
	setFloat(form.DamperMass, &tune.DamperMass)
	setFloat(form.FlywheelMass, &tune.FlywheelMass)
	setFloat(form.VehicleMass, &tune.VehicleMass)

	if tuneProvided {
		if user.SavedTune > 0 {
			if err := app.tunes.UpdateDBWithTune(user.SavedTune, tune); err != nil {
				app.serverError(w, err)
				return
			}
		} else {
			newID, err := app.tunes.Insert(tune)
			if err != nil {
				app.serverError(w, err)
				return
			}
			if newID != nil {
				if err := app.users.UpdateSavedTune(userID, *newID); err != nil {
					app.serverError(w, err)
					return
				}
			}
		}
	}

	app.broadcastTunesUpdate()

	app.sessionManager.Put(r.Context(), "flash", "Profile updated successfully.")
	http.Redirect(w, r, "/user/profile", http.StatusSeeOther)
}

func humanizeDuration(d time.Duration) string {
	years := int(d.Hours() / 24 / 365)
	if years > 0 {
		if years == 1 {
			return "1 year"
		}
		return strconv.Itoa(years) + " years"
	}
	months := int(d.Hours() / 24 / 30)
	if months > 0 {
		if months == 1 {
			return "1 month"
		}
		return strconv.Itoa(months) + " months"
	}
	days := int(d.Hours() / 24)
	if days > 0 {
		if days == 1 {
			return "1 day"
		}
		return strconv.Itoa(days) + " days"
	}
	hours := int(d.Hours())
	if hours > 0 {
		if hours == 1 {
			return "1 hour"
		}
		return strconv.Itoa(hours) + " hours"
	}
	return "just now"
}
