document.getElementById("navProfile").addEventListener("click", () => {
  window.location.href = "account.html";
});

document.getElementById("navSettings").addEventListener("click", () => {
  window.location.href = "settings.html";
});

document.getElementById("navLogout").addEventListener("click", async () => {
  const response = await fetch("/logout", { method: "POST" });
  if (response.ok) {
    window.location.href = "/";
  } else {
    console.error("Logout failed.");
  }
});
