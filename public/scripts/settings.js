// prepare the fields
const currentPass = document.getElementById("current-password");
const newPass = document.getElementById("new-password");
const confirmPass = document.getElementById("confirm-password");

// validates the new/confirm match client-side, then lets the server verify
// the current password and do the actual hash+save in one round trip
async function checkAndUpdatePass() {
  const settingsError = document.getElementById("settingsError");
  settingsError.classList.add("hidden");

  if (newPass.value !== confirmPass.value) {
    settingsError.textContent = "New passwords don't match.";
    settingsError.classList.remove("hidden");
    return;
  }

  const response = await fetch("/changePassword", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentPassword: currentPass.value,
      newPassword: newPass.value,
    }),
  });

  if (response.ok) {
    document.getElementById("passwordSavedModal").showModal();
    // clearing the fields after confirming
    currentPass.value = "";
    newPass.value = "";
    confirmPass.value = "";
  } else {
    // server sends back { error: "..." } (e.g. wrong current password)
    const errorMsg = await response.json();
    settingsError.textContent = `${errorMsg.error}`;
    settingsError.classList.remove("hidden");
  }
}

document
  .getElementById("saveSettings")
  .addEventListener("click", checkAndUpdatePass);
