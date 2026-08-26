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
const loginFormInputs = document.querySelectorAll("#loginForm input");
const signUpFormInputs = document.querySelectorAll("#signupForm input");

// collecting all the information from the login form to send it to the db

const loginError = document.getElementById("loginError");

const loginBtn = document.getElementById("login");
loginBtn.addEventListener("click", async () => {
  if (loginBtn.dataset.loading === "true") return;
  loginError.classList.add("hidden");
  let info = {};
  loginFormInputs.forEach((input) => {
    if (input.type === "email") {
      info["email"] = input.value;
    } else if (input.type === "password") {
      info["password"] = input.value;
    }
  });
  const originalLabel = loginBtn.textContent;
  loginBtn.dataset.loading = "true";
  loginBtn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

  try {
    const response = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(info),
    });
    if (response.ok) {
      // login.js is used in another html file , upon successful login we should do different stuff - this part hanldes normal flow withouth invitation
      if (!location.search.includes("trip=")) {
        window.location.href = "/plan.html";
        // hand over to join.js
      } else {
        handleInviteLogin();
      }
    } else {
      const data = await response.json();
      loginError.textContent = data.error;
      loginError.classList.remove("hidden");
    }
  } catch (error) {
    loginError.textContent = "Could not reach the server. Try again.";
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.dataset.loading = "false";
    loginBtn.textContent = originalLabel;
  }
});

// collecting all the information from the signup form to send it to the db

const signupError = document.getElementById("signupError");

const signupBtn = document.getElementById("signup");
signupBtn.addEventListener("click", async () => {
  if (signupBtn.dataset.loading === "true") return;
  signupError.classList.add("hidden");
  let info = {};
  signUpFormInputs.forEach((input) => {
    if (input.type === "text") {
      info["name"] = input.value;
    } else if (input.type === "email") {
      info["email"] = input.value;
    } else if (input.id === "firstPass") {
      info["firstPass"] = input.value;
    } else if (input.id === "secondPass") {
      info["secondPass"] = input.value;
    }
  });

  // check the name to not be empty
  if (info["name"].trim() === "") {
    signupError.textContent = "Please Enter Your Name.";
    signupError.classList.remove("hidden");
    return;
  }

  // check the email to not be empty
  if (info["email"].trim() === "") {
    signupError.textContent = "Please Enter Your Email.";
    signupError.classList.remove("hidden");
    return;
  }

  // check the password to not be empty
  if (info["firstPass"].trim() === "") {
    signupError.textContent = "Please Enter A Password.";
    signupError.classList.remove("hidden");
    return;
  }

  // check if the password matches
  if (info["firstPass"] === info["secondPass"]) {
    const originalLabel = signupBtn.textContent;
    signupBtn.dataset.loading = "true";
    signupBtn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    try {
      const response = await fetch("/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: info["name"],
          email: info["email"],
          password: info["firstPass"],
        }),
      });
      if (response.ok) {
        if (!location.search.includes("trip=")) {
          window.location.href = "/plan.html";
          if (localStorage.getItem("selectedTripId"))
            localStorage.removeItem("selectedTripId");
        } else {
          handleInviteLogin();
        }
      } else {
        const data = await response.json();
        signupError.textContent = data.error;
        signupError.classList.remove("hidden");
      }
    } catch (error) {
      signupError.textContent = "Could not reach the server. Try again.";
      signupError.classList.remove("hidden");
    } finally {
      signupBtn.dataset.loading = "false";
      signupBtn.textContent = originalLabel;
    }
  } else {
    signupError.textContent = "Passwords don't match.";
    signupError.classList.remove("hidden");
    return;
  }
});
