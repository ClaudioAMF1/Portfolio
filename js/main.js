/* ============================================
   CLAUDIO MEIRELES - PORTFOLIO v2
   JavaScript - Animations & Interactivity
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // ─── Custom Cursor ───
    const cursor = document.getElementById('cursor');
    const cursorFollower = document.getElementById('cursor-follower');
    let mouseX = 0, mouseY = 0;
    let followerX = 0, followerY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursor.style.left = mouseX + 'px';
        cursor.style.top = mouseY + 'px';
    });

    function animateFollower() {
        followerX += (mouseX - followerX) * 0.12;
        followerY += (mouseY - followerY) * 0.12;
        cursorFollower.style.left = followerX + 'px';
        cursorFollower.style.top = followerY + 'px';
        requestAnimationFrame(animateFollower);
    }
    animateFollower();

    // Hover effect on interactive elements
    const hoverSelectors = 'a, button, .project-card, .contact-card, .skill-category, .detail-item, .cert-item, .skill-tag, .quick-item';
    document.querySelectorAll(hoverSelectors).forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.classList.add('hover');
            cursorFollower.classList.add('hover');
        });
        el.addEventListener('mouseleave', () => {
            cursor.classList.remove('hover');
            cursorFollower.classList.remove('hover');
        });
    });

    // ─── Particle Background ───
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.color = Math.random() > 0.5 ? '108, 92, 231' : '0, 206, 201';
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    }

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    const opacity = (1 - distance / 150) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(108, 92, 231, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        drawConnections();
        animationId = requestAnimationFrame(animateParticles);
    }

    initParticles();
    animateParticles();

    // Pause particles when hero is not visible
    const heroSection = document.getElementById('hero');
    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (!animationId) animateParticles();
            } else {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                    animationId = null;
                }
            }
        });
    }, { threshold: 0.1 });
    heroObserver.observe(heroSection);

    // ─── Typewriter Effect ───
    const roles = [
        'Software Developer',
        'Backend Engineer',
        'Data Engineering',
        'Scalable Architectures',
        'Computer Vision',
        'Cloud Computing (AWS)'
    ];
    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    const typewriterEl = document.getElementById('typewriter');

    function typeWriter() {
        const currentRole = roles[roleIndex];

        if (isDeleting) {
            typewriterEl.textContent = currentRole.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typewriterEl.textContent = currentRole.substring(0, charIndex + 1);
            charIndex++;
        }

        let speed = isDeleting ? 30 : 60;

        if (!isDeleting && charIndex === currentRole.length) {
            speed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            speed = 500;
        }

        setTimeout(typeWriter, speed);
    }
    setTimeout(typeWriter, 1000);

    // ─── Navigation ───
    const navbar = document.getElementById('navbar');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const sections = document.querySelectorAll('section[id]');

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;

        // Navbar background
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Active nav link
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 200;
            if (currentScroll >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });

        // Hero parallax
        const heroContent = document.querySelector('.hero-content');
        if (heroContent && currentScroll < window.innerHeight) {
            heroContent.style.transform = `translateY(${currentScroll * 0.15}px)`;
            heroContent.style.opacity = 1 - (currentScroll / (window.innerHeight * 0.8));
        }
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: targetPosition, behavior: 'smooth' });
            }
        });
    });

    // ─── Scroll Animations ───
    const animateElements = document.querySelectorAll('.animate-on-scroll');

    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    animateElements.forEach(el => scrollObserver.observe(el));

    // ─── Counter Animation ───
    let statsAnimated = false;

    function animateStatNumbers() {
        if (statsAnimated) return;
        statsAnimated = true;

        document.querySelectorAll('.stat-number').forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target'));
            const duration = 2000;
            const startTime = performance.now();

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.floor(eased * target);

                stat.textContent = current.toLocaleString('pt-BR');

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    stat.textContent = target.toLocaleString('pt-BR');
                }
            }
            requestAnimationFrame(updateCounter);
        });
    }

    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) animateStatNumbers();
            });
        }, { threshold: 0.5 });
        statsObserver.observe(statsSection);
    }

    // ─── Skill bars animation ───
    const skillsGrid = document.querySelector('.skills-grid');
    if (skillsGrid) {
        const skillsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const progressBars = entry.target.querySelectorAll('.skill-progress');
                    progressBars.forEach((bar, index) => {
                        setTimeout(() => bar.classList.add('animate'), index * 80);
                    });
                }
            });
        }, { threshold: 0.2 });
        skillsObserver.observe(skillsGrid);
    }

    // ─── 3D Tilt on project visual cards ───
    const tiltCards = document.querySelectorAll('.project-visual-card');
    tiltCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 25;
            const rotateY = (centerX - x) / 25;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            card.style.transition = 'none';
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
            card.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    });

    // ─── Photo frame tilt ───
    const photoFrame = document.querySelector('.photo-frame');
    if (photoFrame) {
        photoFrame.addEventListener('mousemove', (e) => {
            const rect = photoFrame.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 30;
            const rotateY = (centerX - x) / 30;

            photoFrame.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            photoFrame.style.transition = 'none';
        });

        photoFrame.addEventListener('mouseleave', () => {
            photoFrame.style.transform = 'perspective(800px) rotateX(0) rotateY(0)';
            photoFrame.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        });
    }

    // ─── Preloader / initial reveal ───
    window.addEventListener('load', () => {
        document.body.style.opacity = '1';
        setTimeout(() => {
            document.querySelectorAll('.hero .animate-on-scroll').forEach((el, i) => {
                setTimeout(() => el.classList.add('visible'), i * 150);
            });
        }, 200);
    });
});
