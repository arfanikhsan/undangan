

document.addEventListener('DOMContentLoaded', () => {
    const hiddenElements = document.querySelectorAll('.hidden');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    hiddenElements.forEach(element => {
        observer.observe(element);
    });
});


document.getElementById('enterButton').addEventListener('click', function() {
    const overlay = document.getElementById('welcomeOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 500); // Match the duration of the CSS transition


    // Play sound
    const clickSound = document.getElementById('clickSound');
    clickSound.play();
});
