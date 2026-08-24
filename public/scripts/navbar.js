const initial = document.getElementById("initial");
initial.textContent = localStorage.getItem("userName")
  ? localStorage.getItem("userName")[0].toUpperCase()
  : "U";

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

const allNavbarLi = [...document.querySelectorAll(".navbar li")];
if (window.location.pathname.includes("plan")) {
  const selectedEl = allNavbarLi
    .filter((el) => el.querySelector("a").textContent.toLowerCase() === "plan")
    .forEach((el) => {
      ((el.style.backgroundColor = "#e0dbfb"),
        (el.style.color = "#534ab7"),
        el.classList.add("rounded-sm", "font-semibold"));
    });
}
if (window.location.pathname.includes("calendar")) {
  const selectedEl = allNavbarLi
    .filter(
      (el) => el.querySelector("a").textContent.toLowerCase() === "calendar",
    )
    .forEach((el) => {
      ((el.style.backgroundColor = "#e0dbfb"),
        (el.style.color = "#534ab7"),
        el.classList.add("rounded-sm", "font-semibold"));
    });
}
if (window.location.pathname.includes("expense")) {
  const selectedEl = allNavbarLi
    .filter(
      (el) => el.querySelector("a").textContent.toLowerCase() === "expense",
    )
    .forEach((el) => {
      ((el.style.backgroundColor = "#e0dbfb"),
        (el.style.color = "#534ab7"),
        el.classList.add("rounded-sm", "font-semibold"));
    });
}
if (window.location.pathname.includes("packing")) {
  const selectedEl = allNavbarLi
    .filter(
      (el) => el.querySelector("a").textContent.toLowerCase() === "packing",
    )
    .forEach((el) => {
      ((el.style.backgroundColor = "#e0dbfb"),
        (el.style.color = "#534ab7"),
        el.classList.add("rounded-sm", "font-semibold"));
    });
}
if (window.location.pathname.includes("account")) {
  const selectedEl = allNavbarLi
    .filter(
      (el) =>
        el.querySelector("a").textContent.trim().toLowerCase() === "profile",
    )
    .forEach((el) => {
      ((el.style.backgroundColor = "#e0dbfb"),
        (el.style.color = "#534ab7"),
        el.classList.add("rounded-sm", "font-semibold"));
    });
}
if (window.location.pathname.includes("settings")) {
  const selectedEl = allNavbarLi
    .filter(
      (el) =>
        el.querySelector("a").textContent.trim().toLowerCase() === "settings",
    )
    .forEach((el) => {
      ((el.style.backgroundColor = "#e0dbfb"),
        (el.style.color = "#534ab7"),
        el.classList.add("rounded-sm", "font-semibold"));
    });
}
