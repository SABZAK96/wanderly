function toggleForms(targetElementId, otherElementId, targetTabId, otherTabId) {
  const targetElement = document.getElementById(targetElementId);
  const otherElement = document.getElementById(otherElementId);
  const targetTab = document.getElementById(targetTabId);
  const otherTab = document.getElementById(otherTabId);
  if (targetElement.hidden) {
    targetElement.hidden = false;
    otherElement.hidden = true;
    targetTab.style.setProperty("border-color", "#534ab7");
    targetTab.style.setProperty("color", "#534ab7");
    targetTab.classList.remove("text-base-content/50");
    otherTab.style.removeProperty("border-color");
    otherTab.style.removeProperty("color");
    otherTab.classList.add("text-base-content/50");
  } else return;
}
document.getElementById("authTabSignup").addEventListener("click", () => {
  toggleForms("signupForm", "loginForm", "authTabSignup", "authTabLogin");
});

document.getElementById("authTabLogin").addEventListener("click", () => {
  toggleForms("loginForm", "signupForm", "authTabLogin", "authTabSignup");
});
