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

document.getElementById("login").addEventListener("click", async () => {
  loginError.classList.add("hidden");
  let info = {};
  loginFormInputs.forEach((input) => {
    if (input.type === "email") {
      info["email"] = input.value;
    } else if (input.type === "password") {
      info["password"] = input.value;
    }
  });

  const response = await fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(info),
  });
  if (response.ok) {
    window.location.href = "/plan.html";
  } else {
    const data = await response.json();
    loginError.textContent = data.error;
    loginError.classList.remove("hidden");
    return;
  }
});

// collecting all the information from the signup form to send it to the db

const signupError = document.getElementById("signupError");

document.getElementById("signup").addEventListener("click", async () => {
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
      window.location.href = "/plan.html";
    } else {
      const data = await response.json();
      signupError.textContent = data.error;
      signupError.classList.remove("hidden");
      return;
    }
  } else {
    signupError.textContent = "Passwords don't match.";
    signupError.classList.remove("hidden");
    return;
  }
});
