document.addEventListener('DOMContentLoaded', () => {
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
        const currentScroll = window.scrollY;

        // Back to top
        if (backToTop) {
            backToTop.classList.toggle('visible', currentScroll > 400);
        }

        // Navbar bg
        if (navbar) {
            navbar.classList.toggle('scrolled', currentScroll > 50);
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
            link.classList.toggle('active', link.getAttribute('href') === '#' + current);
        });
    }

    // Back to top click
    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Mobile menu
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            const isActive = mobileMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', isActive);
            document.body.style.overflow = isActive ? 'hidden' : '';
        });

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                menuToggle.classList.remove('active');
                mobileMenu.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
                menuToggle.focus();
            }
        });
    }

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
        threshold: 0.08,
        rootMargin: '0px 0px -20px 0px'
    });
    animateElements.forEach(el => scrollObserver.observe(el));

    // ─── Toast ───
    const toast = document.getElementById('toast');
    function showToast(message, icon = 'fa-check-circle', duration = 3000) {
        if (!toast) return;
        const toastIcon = toast.querySelector('.toast-icon i');
        const toastMsg = toast.querySelector('.toast-message');
        if (toastIcon) toastIcon.className = `fas ${icon}`;
        if (toastMsg) toastMsg.textContent = message;
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
            charCountEl.textContent = len;
            if (len > 500) {
                messageEl.value = messageEl.value.substring(0, 500);
                charCountEl.textContent = 500;
            }
        });
    }

    function validateField(field, errorId) {
        const errorEl = document.getElementById(errorId);
        let isValid = true;
        let errorMsg = '';

        if (field.required && !field.value.trim()) {
            isValid = false;
            errorMsg = 'Este campo é obrigatório';
        } else if (field.type === 'email' && field.value.trim()) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(field.value.trim())) {
                isValid = false;
                errorMsg = 'Por favor, insira um email válido';
            }
        }

        field.classList.toggle('invalid', !isValid);
        field.classList.toggle('valid', isValid && field.value.trim());

        if (errorEl) {
            errorEl.textContent = errorMsg;
            errorEl.classList.toggle('visible', !isValid);
        }
        return isValid;
    }

    if (contactForm) {
        const requiredFields = contactForm.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => {
                if (field.value.trim()) {
                    validateField(field, field.id + '-error');
                }
            });
            field.addEventListener('input', () => {
                if (field.classList.contains('invalid')) {
                    validateField(field, field.id + '-error');
                }
            });
        });

        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameField = document.getElementById('name');
            const emailField = document.getElementById('email');
            const subjectField = document.getElementById('subject');
            const messageField = document.getElementById('message');

            const isNameValid = validateField(nameField, 'name-error');
            const isEmailValid = validateField(emailField, 'email-error');
            const isMessageValid = validateField(messageField, 'message-error');

            if (!isNameValid || !isEmailValid || !isMessageValid) {
                showToast('Corrija os campos destacados', 'fa-exclamation-circle', 3000);
                return;
            }

            const name = nameField.value.trim();
            const email = emailField.value.trim();
            const subject = subjectField.value.trim();
            const message = messageField.value.trim();

            const mailtoSubject = encodeURIComponent(subject || 'Contato via Portfolio');
            const mailtoBody = encodeURIComponent(`Nome: ${name}\nEmail: ${email}\n\n${message}`);
            window.location.href = `mailto:cmeireles756@gmail.com?subject=${mailtoSubject}&body=${mailtoBody}`;

            showToast('Redirecionando para seu cliente de email...', 'fa-paper-plane', 4000);

            setTimeout(() => {
                contactForm.reset();
                if (charCountEl) charCountEl.textContent = '0';
                contactForm.querySelectorAll('.valid, .invalid').forEach(f => {
                    f.classList.remove('valid', 'invalid');
                });
                contactForm.querySelectorAll('.form-error').forEach(e => {
                    e.classList.remove('visible');
                });
            }, 1000);
        });
    }
});
