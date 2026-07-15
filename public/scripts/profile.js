const userName = document.getElementById("account-name");
const userEmail = document.getElementById("account-email");

// pre-fills the form with the logged-in user's current name/email
async function getUserInfo() {
  const data = await (await fetch("/userInfo")).json();
  userName.value = data.name;
  userEmail.value = data.email;
}
getUserInfo();

// saves the edited name/email, then re-fetches so the form reflects
// exactly what's now stored (in case the server normalizes anything)
document.getElementById("saveAccount").addEventListener("click", async () => {
  const accountError = document.getElementById("accountError");
  accountError.classList.add("hidden");

  const response = await fetch("/editUserInfo", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: userName.value, email: userEmail.value }),
  });
  if (response.ok) {
    await getUserInfo();
    document.getElementById("accountSavedModal").showModal();
  } else {
    // no toast - same contextual red-text pattern used everywhere else in the app
    accountError.textContent =
      "Could not update your profile, please try again.";
    accountError.classList.remove("hidden");
  }
});

// delete the account
document.getElementById("deleteAccount").addEventListener("click", () => {
  document.getElementById("deleteAccountError").classList.add("hidden");
  document.getElementById("deleteAccountConfirmModal").showModal();
});

document
  .getElementById("confirmDeleteAccount")
  .addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    if (btn.dataset.loading === "true") return; // no double clicking

    const originalLabel = btn.innerHTML;
    btn.dataset.loading = true;
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    const response = await fetch("/deleteAccount", { method: "DELETE" });
    if (response.ok) {
      window.location.href = "/";
    } else {
      const deleteAccountError = document.getElementById("deleteAccountError");
      deleteAccountError.textContent =
        "Could not delete your account, please try again.";
      deleteAccountError.classList.remove("hidden");
      btn.dataset.loading = "false";
      btn.innerHTML = originalLabel;
    }
  });
