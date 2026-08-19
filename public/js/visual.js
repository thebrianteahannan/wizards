(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("fx");
  const glow = document.querySelector(".cursor-glow");

  window.addEventListener(
    "pointermove",
    (e) => {
      document.body.style.setProperty("--mx", e.clientX + "px");
      document.body.style.setProperty("--my", e.clientY + "px");
    },
    { passive: true }
  );

  function bootVisuals() {
    document.querySelectorAll(".card, .hero-copy, .hero-stage, .feature, .day, .event").forEach((el, i) => {
      el.classList.add("reveal");
      el.style.animationDelay = Math.min(i * 0.05, 0.4) + "s";
    });
  }
  window.bootVisuals = bootVisuals;

  if (reduce || !canvas) return;
  const ctx = canvas.getContext("2d");
  const dots = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  for (let i = 0; i < 70; i += 1) {
    dots.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.35 - 0.05,
      c: Math.random() > 0.5 ? "rgba(34,211,238," : "rgba(192,38,255,",
      a: Math.random() * 0.55 + 0.15,
    });
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of dots) {
      d.x += d.vx;
      d.y += d.vy;
      if (d.y < -4) d.y = canvas.height + 4;
      if (d.x < -4) d.x = canvas.width + 4;
      if (d.x > canvas.width + 4) d.x = -4;
      ctx.beginPath();
      ctx.fillStyle = d.c + d.a + ")";
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();
  if (glow) glow.style.opacity = "1";
})();
