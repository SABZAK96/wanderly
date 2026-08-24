
const initial = document.getElementById("initial");
initial.textContent = localStorage.getItem("userName") ? localStorage.getItem("userName")[0].toUpperCase() : "U";

async function getUSerInfo() {
  try {
    const response = await fetch(`/userInfo`);
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("userName", data.name);
      initial.textContent = data.name[0].toUpperCase();
      return data.name;
    }
  } catch (error) {
    console.log(error);
  }
}

getUSerInfo();

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
