package models

import (
	"database/sql"
	"errors"

	"github.com/go-sql-driver/mysql"
)

type Tune struct {
	WheelRadius                  float64
	WheelWidth                   float64
	WheelOffset                  float64
	WheelVerticalOffset          float64
	WheelLongitudalOffset        float64
	MaxSteeringAngle             int
	SuspensionLenghtMin          float64
	SuspensionLenghtMax          float64
	SuspensionPreload            float64
	SuspensionDamping            float64
	SuspensionStiffeness         float64
	FrontTyreLateralFriction     float64
	FrontTyreLongitudalFriction  float64
	RearTyreLateralFriction      float64
	RearTyreLongitudalFriction   float64
	FourWheelDrive               bool
	Antirollbar                  bool
	TorqueSplitRatio             float64
	DifferentialLimitedSlipRatio float64
	MaxEngineTorque              float64
	ClutchStrenght               float64
	MinRpm                       float64
	MaxRpm                       float64
	DamperMass                   float64
	FlywheelMass                 float64
	VehicleMass                  float64
}
type TuneModel struct {
	DB *sql.DB
}

type TuneModelIntarface interface {
	Insert(tune Tune) (*int, error)
	Get(id int) (*Tune, error)
	UpdateDBWithTune(int, Tune) error
}

func (t *TuneModel) UpdateDBWithTune(id int, tune Tune) error {
	stmt := `UPDATE tunes SET 
		wheel_radius = ?,
		wheel_width = ?,
		wheel_offset = ?,
		wheel_vertical_offset = ?,
		wheel_longitudal_offset = ?,
		max_steering_angle = ?,
		suspension_lenght_min = ?,
		suspension_lenght_max = ?,
		suspension_preload = ?,
		suspension_damping = ?,
		suspension_stiffness = ?,
		front_tyre_lateral_friction = ?,
		front_tyre_longitudal_friction = ?,
		rear_tyre_lateral_friction = ?,
		rear_tyre_longitudal_friction = ?,
		four_wheel_drive = ?,
		antirollbar = ?,
		torque_split_ratio = ?,
		differential_limited_slip_ratio = ?,
		max_engine_torque = ?,
		clutch_strenght = ?,
		min_rpm = ?,
		max_rpm = ?,
		damper_mass = ?,
		flywheel_mass = ?,
		vehicle_mass = ?
		WHERE id = ?`

	_, err := t.DB.Exec(stmt,
		tune.WheelRadius,
		tune.WheelWidth,
		tune.WheelOffset,
		tune.WheelVerticalOffset,
		tune.WheelLongitudalOffset,
		tune.MaxSteeringAngle,
		tune.SuspensionLenghtMin,
		tune.SuspensionLenghtMax,
		tune.SuspensionPreload,
		tune.SuspensionDamping,
		tune.SuspensionStiffeness,
		tune.FrontTyreLateralFriction,
		tune.FrontTyreLongitudalFriction,
		tune.RearTyreLateralFriction,
		tune.RearTyreLongitudalFriction,
		tune.FourWheelDrive,
		tune.Antirollbar,
		tune.TorqueSplitRatio,
		tune.DifferentialLimitedSlipRatio,
		tune.MaxEngineTorque,
		tune.ClutchStrenght,
		tune.MinRpm,
		tune.MaxRpm,
		tune.DamperMass,
		tune.FlywheelMass,
		tune.VehicleMass,
		id,
	)
	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return mySQLError
		} else {
			return err
		}
	}
	return nil
}
func (t *TuneModel) Get(id int) (*Tune, error) {
	tune := NewTune()

	stmt := `SELECT
        id,
        wheel_radius,
        wheel_width,
        wheel_offset,
        wheel_vertical_offset,
        wheel_longitudal_offset,
        max_steering_angle,
        suspension_lenght_min,
        suspension_lenght_max,
        suspension_preload,
        suspension_damping,
        suspension_stiffness,
        front_tyre_lateral_friction,
        front_tyre_longitudal_friction,
        rear_tyre_lateral_friction,
        rear_tyre_longitudal_friction,
        four_wheel_drive,
        antirollbar,
        torque_split_ratio,
        differential_limited_slip_ratio,
        max_engine_torque,
        clutch_strenght,
        min_rpm,
        max_rpm,
        damper_mass,
        flywheel_mass,
        vehicle_mass
    FROM tunes WHERE id = ?`

	var tuneID int
	err := t.DB.QueryRow(stmt, id).Scan(
		&tuneID,
		&tune.WheelRadius,
		&tune.WheelWidth,
		&tune.WheelOffset,
		&tune.WheelVerticalOffset,
		&tune.WheelLongitudalOffset,
		&tune.MaxSteeringAngle,
		&tune.SuspensionLenghtMin,
		&tune.SuspensionLenghtMax,
		&tune.SuspensionPreload,
		&tune.SuspensionDamping,
		&tune.SuspensionStiffeness,
		&tune.FrontTyreLateralFriction,
		&tune.FrontTyreLongitudalFriction,
		&tune.RearTyreLateralFriction,
		&tune.RearTyreLongitudalFriction,
		&tune.FourWheelDrive,
		&tune.Antirollbar,
		&tune.TorqueSplitRatio,
		&tune.DifferentialLimitedSlipRatio,
		&tune.MaxEngineTorque,
		&tune.ClutchStrenght,
		&tune.MinRpm,
		&tune.MaxRpm,
		&tune.DamperMass,
		&tune.FlywheelMass,
		&tune.VehicleMass,
	)
	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return nil, mySQLError
		}
		return nil, err
	}
	return &tune, nil
}

func (t *TuneModel) Insert(tune Tune) (*int, error) {
	stmt := `INSERT INTO tunes(
	wheel_radius,
	wheel_width,
	wheel_offset,
	wheel_vertical_offset,
	wheel_longitudal_offset,
	max_steering_angle,
	suspension_lenght_min,
	suspension_lenght_max,
	suspension_preload,
	suspension_damping,
	suspension_stiffness,
	front_tyre_lateral_friction,
	front_tyre_longitudal_friction,
	rear_tyre_lateral_friction,
	rear_tyre_longitudal_friction,
	four_wheel_drive,
	antirollbar,
	torque_split_ratio,
	differential_limited_slip_ratio,
	max_engine_torque,
	clutch_strenght,
	min_rpm,
	max_rpm,
	damper_mass,
	flywheel_mass,
	vehicle_mass
		)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`

	result, err := t.DB.Exec(stmt,
		tune.WheelRadius,
		tune.WheelWidth,
		tune.WheelOffset,
		tune.WheelVerticalOffset,
		tune.WheelLongitudalOffset,
		tune.MaxSteeringAngle,
		tune.SuspensionLenghtMin,
		tune.SuspensionLenghtMax,
		tune.SuspensionPreload,
		tune.SuspensionDamping,
		tune.SuspensionStiffeness,
		tune.FrontTyreLateralFriction,
		tune.FrontTyreLongitudalFriction,
		tune.RearTyreLateralFriction,
		tune.RearTyreLongitudalFriction,
		tune.FourWheelDrive,
		tune.Antirollbar,
		tune.TorqueSplitRatio,
		tune.DifferentialLimitedSlipRatio,
		tune.MaxEngineTorque,
		tune.ClutchStrenght,
		tune.MinRpm,
		tune.MaxRpm,
		tune.DamperMass,
		tune.FlywheelMass,
		tune.VehicleMass)

	if err != nil {
		var mySQLError *mysql.MySQLError
		if errors.As(err, &mySQLError) {
			return nil, mySQLError
		}
	}

	insertedID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int(insertedID)
	return &id, nil
}

func NewTune() Tune {
	return Tune{
		WheelRadius:                  0.55,
		WheelWidth:                   0.6,
		WheelOffset:                  -0.2,
		WheelVerticalOffset:          -0.64,
		WheelLongitudalOffset:        0.4,
		MaxSteeringAngle:             45,
		SuspensionLenghtMin:          0.4,
		SuspensionLenghtMax:          1,
		SuspensionPreload:            1,
		SuspensionDamping:            1,
		SuspensionStiffeness:         1,
		FrontTyreLateralFriction:     15,
		FrontTyreLongitudalFriction:  1,
		RearTyreLateralFriction:      2,
		RearTyreLongitudalFriction:   15,
		FourWheelDrive:               false,
		Antirollbar:                  true,
		TorqueSplitRatio:             1.4,
		DifferentialLimitedSlipRatio: 1.3,
		MaxEngineTorque:              2500,
		ClutchStrenght:               1000,
		MinRpm:                       400,
		MaxRpm:                       8000,
		DamperMass:                   1,
		FlywheelMass:                 1,
		VehicleMass:                  1200,
	}
}
