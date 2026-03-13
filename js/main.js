document.addEventListener('DOMContentLoaded', () => {

    // ─── Scroll-driven reveals ───
    const revealElements = document.querySelectorAll(
        '.section-heading, .section-header-row, .about-left, .about-right, ' +
        '.project-item, .skills-layout, .exp-item, .contact-intro, .contact-grid'
    );
    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ─── Skill bars animation ───
    const skillBars = document.querySelectorAll('.skill-fill');
    const skillObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const fills = entry.target.querySelectorAll('.skill-fill');
                fills.forEach((fill, i) => {
                    setTimeout(() => fill.classList.add('animate'), i * 100);
                });
                skillObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    const skillSection = document.querySelector('.skill-list');
    if (skillSection) skillObserver.observe(skillSection.parentElement);

    // ─── Navigation ───
    const navbar = document.getElementById('navbar');
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-link');
    const sections = document.querySelectorAll('section[id]');
    const backToTop = document.getElementById('back-to-top');

    // Scroll handler
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    });

    function handleScroll() {
        const y = window.scrollY;

        if (backToTop) backToTop.classList.toggle('visible', y > 500);
        if (navbar) navbar.classList.toggle('scrolled', y > 60);

        // Active section
        let current = '';
        sections.forEach(s => {
            if (y >= s.offsetTop - 200) current = s.id;
        });
        navLinks.forEach(l => {
            l.classList.toggle('active', l.getAttribute('href') === '#' + current);
        });
    }

    // Back to top
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Mobile menu
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            const active = mobileMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', active);
            document.body.style.overflow = active ? 'hidden' : '';
        });

        const closeMenu = () => {
            menuToggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        };

        mobileLinks.forEach(l => l.addEventListener('click', closeMenu));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                closeMenu();
                menuToggle.focus();
            }
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.scrollY - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ─── Hero entrance ───
    const heroElements = document.querySelectorAll('.hero-top, .hero-name-line, .hero-bottom, .hero-scroll');
    heroElements.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)`;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 100 + i * 120);
    });

    // ─── Toast ───
    const toast = document.getElementById('toast');
    function showToast(msg, duration = 3000) {
        if (!toast) return;
        toast.querySelector('.toast-message').textContent = msg;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), duration);
    }

    // ─── Contact Form ───
    const contactForm = document.getElementById('contact-form');
    const charCountEl = document.getElementById('char-count');
    const messageEl = document.getElementById('message');

    if (messageEl && charCountEl) {
        messageEl.addEventListener('input', () => {
            const len = messageEl.value.length;
            charCountEl.textContent = Math.min(len, 500);
            if (len > 500) messageEl.value = messageEl.value.substring(0, 500);
        });
    }

    function validateField(field, errorId) {
        const errorEl = document.getElementById(errorId);
        let valid = true, msg = '';

        if (field.required && !field.value.trim()) {
            valid = false;
            msg = 'Campo obrigatório';
        } else if (field.type === 'email' && field.value.trim()) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) {
                valid = false;
                msg = 'Email inválido';
            }
        }

        field.classList.toggle('invalid', !valid);
        field.classList.toggle('valid', valid && field.value.trim());
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.toggle('visible', !valid);
        }
        return valid;
    }

    if (contactForm) {
        contactForm.querySelectorAll('[required]').forEach(f => {
            f.addEventListener('blur', () => {
                if (f.value.trim()) validateField(f, f.id + '-error');
            });
            f.addEventListener('input', () => {
                if (f.classList.contains('invalid')) validateField(f, f.id + '-error');
            });
        });

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const n = document.getElementById('name');
            const em = document.getElementById('email');
            const sub = document.getElementById('subject');
            const msg = document.getElementById('message');

            const v1 = validateField(n, 'name-error');
            const v2 = validateField(em, 'email-error');
            const v3 = validateField(msg, 'message-error');

            if (!v1 || !v2 || !v3) {
                showToast('Corrija os campos destacados');
                return;
            }

            const s = encodeURIComponent(sub.value.trim() || 'Contato via Portfolio');
            const b = encodeURIComponent(`Nome: ${n.value.trim()}\nEmail: ${em.value.trim()}\n\n${msg.value.trim()}`);
            window.location.href = `mailto:cmeireles756@gmail.com?subject=${s}&body=${b}`;
            showToast('Redirecionando para seu email...', 4000);

            setTimeout(() => {
                contactForm.reset();
                if (charCountEl) charCountEl.textContent = '0';
                contactForm.querySelectorAll('.valid, .invalid').forEach(f => f.classList.remove('valid', 'invalid'));
                contactForm.querySelectorAll('.form-error').forEach(e => e.classList.remove('visible'));
            }, 1000);
        });
    }
});
