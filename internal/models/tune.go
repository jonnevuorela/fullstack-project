package models

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
		SuspensionStiffeness:         1,
		FrontTyreLateralFriction:     1,
		FrontTyreLongitudalFriction:  1,
		RearTyreLateralFriction:      1,
		RearTyreLongitudalFriction:   1,
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
