const contactLinks = document.querySelectorAll("a[href='#contact']");
const contactSection = document.querySelectorAll("#contact");

contactLinks.forEach(link => {
    link.addEventListener('click', () => {
        contactSection.classList.add("highlight");
    });
});

