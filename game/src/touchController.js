// Pohjana AI generoitu lähtökohta. Claude Sonnet 3.5
export default class TouchController {
    constructor(game, container) {
        this.game = game;
        this.container = container;
        this.controls = null;
        this.joystick = null;
        this.buttons = new Map();
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (this.isMobile) {
            this.init();
        }
    }

    init() {
        this.controls = document.createElement('div');
        this.controls.className = 'touch-controls';

        this.createJoystick();

        this.createActionButtons();

        this.container.appendChild(this.controls);
    }

    createJoystick() {
        const joystickContainer = document.createElement('div');
        joystickContainer.className = 'touch-joystick';

        const joystickThumb = document.createElement('div');
        joystickThumb.className = 'touch-joystick-thumb';
        joystickContainer.appendChild(joystickThumb);

        this.controls.appendChild(joystickContainer);

        this.joystick = {
            element: joystickContainer,
            thumb: joystickThumb,
            active: false,
            startPos: { x: 0, y: 0 },
            currentPos: { x: 0, y: 0 },
            value: { x: 0, y: 0 },
            maxRadius: 40
        };

        joystickContainer.addEventListener('touchstart', (e) => this.handleJoystickStart(e));
        joystickContainer.addEventListener('touchmove', (e) => this.handleJoystickMove(e));
        joystickContainer.addEventListener('touchend', () => this.handleJoystickEnd());
        joystickContainer.addEventListener('touchcancel', () => this.handleJoystickEnd());
    }


    createActionButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'touch-buttons';
        this.controls.appendChild(buttonContainer);

        const buttons = [
            {
                id: 'accelerate',
                label: 'A',
                className: 'touch-button touch-accelerate',
                handlers: {
                    start: () => this.game.input.forwardPressed = true,
                    end: () => this.game.input.forwardPressed = false
                }
            },
            {
                id: 'brake',
                label: 'B',
                className: 'touch-button touch-brake',
                handlers: {
                    start: () => this.game.input.backwardPressed = true,
                    end: () => this.game.input.backwardPressed = false
                }
            },
            {
                id: 'handbrake',
                label: 'H',
                className: 'touch-button touch-handbrake',
                handlers: {
                    start: () => this.game.input.handBrake = true,
                    end: () => this.game.input.handBrake = false
                }
            }
        ];

        buttons.forEach(btn => {
            const button = document.createElement('div');
            button.id = btn.id;
            button.className = btn.className;
            button.textContent = btn.label;

            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.handlers.start();
                button.classList.add('active');
            });

            button.addEventListener('touchend', () => {
                btn.handlers.end();
                button.classList.remove('active');
            });

            buttonContainer.appendChild(button);
            this.buttons.set(btn.id, button);
        });
    }

    handleJoystickStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.joystick.element.getBoundingClientRect();

        this.joystick.active = true;
        this.joystick.startPos = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        this.updateJoystickPosition(touch.clientX, touch.clientY);
    }

    handleJoystickMove(event) {
        if (!this.joystick.active) return;
        event.preventDefault();

        const touch = event.touches[0];
        this.updateJoystickPosition(touch.clientX, touch.clientY);
    }

    handleJoystickEnd() {
        this.joystick.active = false;
        this.joystick.value = { x: 0, y: 0 };
        this.joystick.thumb.style.transform = 'translate(-50%, -50%)';

        this.game.input.leftPressed = false;
        this.game.input.rightPressed = false;
        this.game.input.forwardPressed = false;
        this.game.input.backwardPressed = false;
    }

    updateJoystickPosition(touchX, touchY) {
        const dx = touchX - this.joystick.startPos.x;
        const dy = touchY - this.joystick.startPos.y;

        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const deadzone = 0.2;
        const normalizedDistance = Math.min(distance, this.joystick.maxRadius) / this.joystick.maxRadius;

        if (normalizedDistance < deadzone) {
            this.joystick.value = { x: 0, y: 0 };
        } else {
            this.joystick.value = {
                x: Math.cos(angle) * normalizedDistance,
                y: Math.sin(angle) * normalizedDistance
            };
        }

        const moveDistance = Math.min(distance, this.joystick.maxRadius);
        const moveX = Math.cos(angle) * moveDistance;
        const moveY = Math.sin(angle) * moveDistance;
        this.joystick.thumb.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;

        // Only update steering (left/right)
        this.game.input.leftPressed = this.joystick.value.x < -0.5;
        this.game.input.rightPressed = this.joystick.value.x > 0.5;
        // Remove forward/backward control from joystick
        // this.game.input.forwardPressed = this.joystick.value.y < -0.5;
        // this.game.input.backwardPressed = this.joystick.value.y > 0.5;
    }

    cleanup() {
        if (this.controls && this.controls.parentNode) {
            this.controls.parentNode.removeChild(this.controls);
        }
        this.buttons.clear();
        this.joystick = null;
    }
}
