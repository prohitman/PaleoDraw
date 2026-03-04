// Navigation logic for help documentation
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-link")
  const sections = document.querySelectorAll(".help-section")

  // Handle navigation clicks
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()

      // Get target section
      const targetId = link.getAttribute("href").substring(1)

      // Update active states
      navLinks.forEach((l) => l.classList.remove("active"))
      sections.forEach((s) => s.classList.remove("active"))

      link.classList.add("active")
      const targetSection = document.getElementById(targetId)
      if (targetSection) {
        targetSection.classList.add("active")
        // Scroll to top of content area
        document.querySelector(".help-content").scrollTop = 0
      }
    })
  })

  // Listen for theme changes from parent window
  window.addEventListener("message", (event) => {
    if (event.data.type === "theme-change") {
      document.documentElement.setAttribute("data-theme", event.data.theme)
    }
  })

  // Request initial theme from parent
  if (window.parent !== window) {
    window.parent.postMessage({ type: "request-theme" }, "*")
  }
})
