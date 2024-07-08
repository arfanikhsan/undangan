document.addEventListener("DOMContentLoaded", function() {
  gsap.registerPlugin(ScrollTrigger);

  gsap.to("#layer1 .content", {
      yPercent: 20,
      ease: "none",
      scrollTrigger: {
          trigger: ".parallax-section",
          start: "top top",
          end: "bottom top",
          scrub: true
      }
  });

  gsap.to("#layer2 .content", {
      yPercent: 40,
      ease: "none",
      scrollTrigger: {
          trigger: ".parallax-section",
          start: "top top",
          end: "bottom top",
          scrub: true
      }
  });

  gsap.to("#layer3 .content", {
      yPercent: 60,
      ease: "none",
      scrollTrigger: {
          trigger: ".parallax-section",
          start: "top top",
          end: "bottom top",
          scrub: true
      }
  });
});
