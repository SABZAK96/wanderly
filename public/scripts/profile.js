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
    accountError.textContent = "Could not update your profile, please try again.";
    accountError.classList.remove("hidden");
  }
});
