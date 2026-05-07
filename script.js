document.addEventListener("DOMContentLoaded", () => {
    // Typing effect for the greeting
    const textToType = "你好！我是陳俞潔，很高興認識你 ✨";
    const typingElement = document.getElementById("typing-text");
    let i = 0;

    function typeWriter() {
        if (i < textToType.length) {
            typingElement.innerHTML += textToType.charAt(i);
            i++;
            setTimeout(typeWriter, 100); // Speed of typing
        }
    }

    // Start typing effect with a slight delay
    setTimeout(typeWriter, 800);

    // 3D Tilt Effect on the glass card
    const card = document.getElementById("card");

    // Only apply 3D effect on non-mobile devices
    if (window.innerWidth > 768) {
        document.addEventListener("mousemove", (e) => {
            // Calculate mouse position relative to center of screen
            const xAxis = (window.innerWidth / 2 - e.pageX) / 40;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 40;
            
            // Apply transformation
            card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
        });

        // Reset card tilt when mouse leaves window
        document.addEventListener("mouseleave", () => {
            card.style.transform = `rotateY(0deg) rotateX(0deg)`;
            card.style.transition = "transform 0.5s ease"; // Add smooth transition back
        });
        
        document.addEventListener("mouseenter", () => {
            card.style.transition = "none"; // Remove transition for instant follow
        });
    }
});
