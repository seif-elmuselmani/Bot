const app = {
    audio: null,
    musicStarted: false,

    init() {
        this.loadConfig();
        this.setupAudio();
        this.attachEventListeners();
        this.startFloatingHearts();
        this.splitTextElements();
    },

    splitTextElements() {
        // Find all titles and paragraphs and wrap their characters in spans for GSAP
        const textElements = document.querySelectorAll('.title, .letter-paper p, .collage-note p');
        textElements.forEach(el => {
            const words = el.innerText.split(' ');
            el.innerHTML = '';
            words.forEach(word => {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'word';
                word.split('').forEach(char => {
                    const charSpan = document.createElement('span');
                    charSpan.className = 'char';
                    charSpan.innerText = char;
                    wordSpan.appendChild(charSpan);
                });
                el.appendChild(wordSpan);
            });
        });
    },

    loadConfig() {
        // Intro
        document.getElementById('text-intro-title').innerText = Config.texts.introTitle;
        document.getElementById('text-intro-subtitle').innerText = Config.texts.introSubtitle;
        document.getElementById('img-intro-cake').src = Config.assets.cakeIcon;

        // Choose Gift
        document.getElementById('text-choose-title').innerText = Config.texts.chooseGiftTitle;
        document.getElementById('img-gift-message').src = Config.assets.envelopeIcon;
        document.getElementById('img-gift-flower').src = Config.assets.flowerIcon;
        document.getElementById('img-gift-cake').src = Config.assets.cakeIcon;

        // Message
        document.getElementById('text-message-title').innerText = Config.texts.messageTitle;
        document.getElementById('text-message-body').innerText = Config.texts.messageBody;
        document.getElementById('img-message-tag').src = Config.assets.messageTagPhoto;
        document.getElementById('text-message-tag').innerText = Config.texts.messageTag;
        document.getElementById('btn-back-message').innerText = Config.texts.goBack;

        const messagePolaroidsContainer = document.getElementById('message-polaroids');
        Config.assets.messagePhotos.forEach(src => {
            let img = document.createElement('img');
            img.src = src;
            img.className = 'polaroid-img';
            messagePolaroidsContainer.appendChild(img);
        });

        // Flower
        document.getElementById('text-flower-title').innerText = Config.texts.flowerTitle;
        document.getElementById('img-flower-main').src = Config.assets.flowerImage;
        document.getElementById('btn-back-flower').innerText = Config.texts.goBack;

        const flowerPolaroidsContainer = document.getElementById('flower-polaroids');
        Config.assets.flowerPhotos.forEach((src, idx) => {
            let img = document.createElement('img');
            img.src = src;
            img.style.left = `${idx * 40}px`;
            img.style.top = `${idx * 20}px`;
            img.style.transform = `rotate(${idx % 2 === 0 ? 10 : -10}deg)`;
            flowerPolaroidsContainer.appendChild(img);
        });

        // Collage
        document.getElementById('img-collage-main').src = Config.assets.collageMainPhoto;
        document.getElementById('btn-back-collage').innerText = Config.texts.goBackOrLastPage;

        // Hearts
        const heartsContainer = document.getElementById('hearts-container');
        Config.assets.heartsPhotos.forEach(src => {
            let wrap = document.createElement('div');
            wrap.className = 'heart-wrap';
            let frame = document.createElement('div');
            frame.className = 'heart-frame';
            let img = document.createElement('img');
            img.src = src;
            frame.appendChild(img);
            wrap.appendChild(frame);
            heartsContainer.appendChild(wrap);
        });
    },

    setupAudio() {
        this.audio = new Howl({
            src: [Config.assets.music],
            loop: true,
            volume: 0.7
        });
    },

    playMusic() {
        if (!this.musicStarted) {
            this.audio.play();
            this.musicStarted = true;
        }
    },

    fireConfetti() {
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#ffb6c1', '#ff69b4', '#ffffff', '#ffd700']
        });
    },

    startFloatingHearts() {
        // Create random floating elements in background
        setInterval(() => {
            const heart = document.createElement('div');
            heart.innerHTML = '❤️';
            heart.style.position = 'absolute';
            heart.style.left = Math.random() * 100 + 'vw';
            heart.style.top = '110vh';
            heart.style.fontSize = (Math.random() * 20 + 10) + 'px';
            heart.style.opacity = Math.random() * 0.5 + 0.1;
            heart.style.zIndex = '0';
            document.body.appendChild(heart);

            gsap.to(heart, {
                y: -window.innerHeight - 100,
                x: `+=${Math.random() * 100 - 50}`,
                rotation: Math.random() * 360,
                duration: Math.random() * 5 + 5,
                ease: 'linear',
                onComplete: () => heart.remove()
            });
        }, 800);
    },

    attachEventListeners() {
        document.getElementById('img-intro-cake').addEventListener('click', () => {
            this.playMusic();
            this.fireConfetti();
            this.showScreen('screen-choose');
        });

        // 3D Hover effects for gifts
        const gifts = document.querySelectorAll('.gift-item img');
        gifts.forEach(gift => {
            gift.addEventListener('mousemove', (e) => {
                const rect = gift.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                gsap.to(gift, { rotationY: x / 5, rotationX: -y / 5, duration: 0.2, ease: 'power1.out' });
            });
            gift.addEventListener('mouseleave', () => {
                gsap.to(gift, { rotationY: 0, rotationX: 0, duration: 0.5, ease: 'power1.out' });
            });
        });
    },

    showScreen(targetScreenId) {
        const currentScreen = document.querySelector('.screen.active');
        const targetScreen = document.getElementById(targetScreenId);

        if (currentScreen === targetScreen) return;

        // Custom animations based on screen
        gsap.to(currentScreen, {
            opacity: 0,
            y: -50,
            duration: 0.6,
            ease: "power2.in",
            onComplete: () => {
                currentScreen.classList.remove('active');
                currentScreen.classList.add('hidden');
                
                targetScreen.classList.remove('hidden');
                targetScreen.classList.add('active');
                
                // Advanced entry animation
                gsap.fromTo(targetScreen, 
                    { opacity: 0, scale: 0.95, y: 30 }, 
                    { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: "power3.out" }
                );

                // Animate inner elements (images, polaroids)
                const itemsToAnimate = targetScreen.querySelectorAll('.polaroid-img, .letter-paper, .main-flower, .heart-wrap, .collage-center, .collage-deco, .tag-card');
                if(itemsToAnimate.length > 0) {
                    gsap.fromTo(itemsToAnimate, 
                        { opacity: 0, rotation: () => Math.random() * 20 - 10, scale: 0.8 },
                        { opacity: 1, rotation: (i, target) => {
                            // Preserve original rotation if set in CSS/JS
                            return target.style.transform.includes('rotate') ? target.style.transform : 0;
                        }, scale: 1, duration: 1, stagger: 0.1, ease: "power2.out", delay: 0.2 }
                    );
                }

                // Animate Text Characters smoothly
                const chars = targetScreen.querySelectorAll('.char');
                if(chars.length > 0) {
                    gsap.fromTo(chars, 
                        { opacity: 0, y: 15 },
                        { opacity: 1, y: 0, duration: 0.4, stagger: 0.02, ease: "power1.out", delay: 0.3 }
                    );
                }
            }
        });
    }
};

// Initialize App
app.init();
