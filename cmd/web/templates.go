package main

import (
	"html/template"
	"io/fs"
	"path/filepath"
	"time"

	"fullstack-project.jonnevuorela.com/ui"
)

type templateData struct {
	CurrentYear     int
	Form            any
	Flash           string
	IsAuthenticated bool
	CSRFToken       string
	PlayerID        int
	Nonce           string

	PlayerUsername string
	PlayerTune     *clientTune
	PlayerLocation *clientLocation
}
type clientLocation struct {
	PositionX float64 `json:"position_x"`
	PositionY float64 `json:"position_y"`
	PositionZ float64 `json:"position_z"`
	RotationX float64 `json:"rotation_x"`
	RotationY float64 `json:"rotation_y"`
	RotationZ float64 `json:"rotation_z"`
	RotationW float64 `json:"rotation_w"`
}
type clientTune struct {
	WheelRadius           float64 `json:"wheel_radius"`
	WheelWidth            float64 `json:"wheel_width"`
	WheelOffset           float64 `json:"wheel_offset"`
	WheelVerticalOffset   float64 `json:"wheel_vertical_offset"`
	WheelLongitudalOffset float64 `json:"wheel_longitudal_offset"`

	MaxSteeringAngle int `json:"max_steering_angle"`

	SuspensionLenghtMin  float64 `json:"suspension_lenght_min"`
	SuspensionLenghtMax  float64 `json:"suspension_lenght_max"`
	SuspensionPreload    float64 `json:"suspension_preload"`
	SuspensionDamping    float64 `json:"suspension_damping"`
	SuspensionStiffeness float64 `json:"suspension_stiffness"`

	FrontTyreLateralFriction    float64 `json:"front_tyre_lateral_friction"`
	FrontTyreLongitudalFriction float64 `json:"front_tyre_longitudal_friction"`
	RearTyreLateralFriction     float64 `json:"rear_tyre_lateral_friction"`
	RearTyreLongitudalFriction  float64 `json:"rear_tyre_longitudal_friction"`

	FourWheelDrive               bool    `json:"four_wheel_drive"`
	Antirollbar                  bool    `json:"antirollbar"`
	TorqueSplitRatio             float64 `json:"torque_split_ratio"`
	DifferentialLimitedSlipRatio float64 `json:"differential_limited_slip_ratio"`
	MaxEngineTorque              float64 `json:"max_engine_torque"`
	ClutchStrenght               float64 `json:"clutch_strenght"`
	MinRpm                       float64 `json:"min_rpm"`
	MaxRpm                       float64 `json:"max_rpm"`
	DamperMass                   float64 `json:"damper_mass"`
	FlywheelMass                 float64 `json:"flywheel_mass"`
	VehicleMass                  float64 `json:"vehicle_mass"`
}

var functions = template.FuncMap{
	"humanDate":   humanDate,
	"currentYear": time.Now().Year,
}

func humanDate(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format("02 Jan 2006 at 15:04")
}

func newTemplateCache() (map[string]*template.Template, error) {
	cache := map[string]*template.Template{}

	pages, err := fs.Glob(ui.Files, "html/pages/*.tmpl")
	if err != nil {
		return nil, err
	}

	for _, page := range pages {
		name := filepath.Base(page)

		patterns := []string{
			"html/base.tmpl",
			"html/partials/*.tmpl",
			page,
		}

		ts, err := template.New(name).Funcs(functions).ParseFS(ui.Files, patterns...)
		if err != nil {
			return nil, err
		}

		cache[name] = ts
	}

	return cache, nil
}
