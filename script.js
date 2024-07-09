

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

document.addEventListener('DOMContentLoaded', function () {
    var targets = [
        { div: document.getElementById('target-div1'), audio: document.getElementById('sound1'), played: false },
        { div: document.getElementById('target-div2'), audio: document.getElementById('sound2'), played: false },
        { div: document.getElementById('target-div3'), audio: document.getElementById('sound3'), played: false },
        { div: document.getElementById('target-div4'), audio: document.getElementById('sound4'), played: false },
        { div: document.getElementById('target-div5'), audio: document.getElementById('sound5'), played: false },
        { div: document.getElementById('target-div6'), audio: document.getElementById('sound6'), played: false },
        { div: document.getElementById('target-div7'), audio: document.getElementById('sound7'), played: false },
        { div: document.getElementById('target-div8'), audio: document.getElementById('sound8'), played: false },
        { div: document.getElementById('target-div9'), audio: document.getElementById('sound9'), played: false },
        { div: document.getElementById('target-div10'), audio: document.getElementById('sound10'), played: false },
        { div: document.getElementById('target-div11'), audio: document.getElementById('sound11'), played: false },
        { div: document.getElementById('target-div12'), audio: document.getElementById('sound12'), played: false },
        { div: document.getElementById('target-div13'), audio: document.getElementById('sound13'), played: false },
        { div: document.getElementById('target-div14'), audio: document.getElementById('sound14'), played: false },
        { div: document.getElementById('target-div15'), audio: document.getElementById('sound15'), played: false },
        { div: document.getElementById('target-div16'), audio: document.getElementById('sound16'), played: false },
        
    ];

    var options = {
        root: null, // Use the viewport as the root
        rootMargin: '0px',
        threshold: 0.5 // Play the sound when 50% of the div is visible
    };

    targets.forEach(function (target) {
        var observer = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !target.played) {
                    target.audio.play();
                    target.played = true;
                }
            });
        }, options);

        observer.observe(target.div);
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
