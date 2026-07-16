// get the trip id from the url in the current window
function getInfoFromUrl() {
  // URLSearchParams is a js class for pasring and creating the query strings (the part of url after ?)
  const searchparams = new URLSearchParams(location.search);
  const tripId = searchparams.get("trip");
  const inviter = searchparams.get("from");
  return { tripId, inviter };
}

// find out which modal to show based on the server response
async function handleInviteLogin() {
  const urlInfo = getInfoFromUrl();
  const res = await fetch(`/joinTrip/${urlInfo.tripId}`);
  const response = await res.json();

  if (res.ok) {
    if (response.permission === true) {
      document.getElementById("confirmJoinModal").showModal();

      const start = response.startDate.slice(0, 10);
      const end = response.endDate.slice(0, 10);
      const date = formatTripDates(start, end);

      document.getElementById("tripDestination").textContent =
        response.destination;
      document.getElementById("tripDates").textContent = date.full;

      // resolve the inviter's id (from the "from" query param) to their name
      const people = await (await fetch(`/people/${urlInfo.tripId}`)).json();
      const inviter = people.find((person) => person._id === urlInfo.inviter);
      
      // fallback for a stale link - the inviter left the trip or deleted their account since sharing it
      document.getElementById("tripInviter").textContent = inviter
        ? inviter.name
        : "a trip member";

    } else if (response.permission === false && !response.destination) {
      document.getElementById("invalidLinkModal").showModal();
    } else {
      document.getElementById("alreadyMemberModal").showModal();
      document.getElementById("nameTrip").textContent = response.destination;

      const start = response.startDate.slice(0, 10);
      const end = response.endDate.slice(0, 10);
      const dates = formatTripDates(start, end);

      document.getElementById("dateTrip").textContent = dates.full;
    }
  }
}

document.getElementById("joinTripBtn").addEventListener("click", async (event) => {
  const btn = event.currentTarget;
  if (btn.dataset.loading === "true") return; // guard against double-click

  const joinError = document.getElementById("joinError");
  joinError.classList.add("hidden");

  const originalLabel = btn.innerHTML;
  btn.dataset.loading = "true";
  btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

  const tripId = getInfoFromUrl().tripId;
  const response = await fetch("/joinPerson", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tripId }),
  });

  if (response.ok) {
    window.location.href = "/plan.html";
  } else {
    joinError.textContent = "Could not join the trip. Please try again.";
    joinError.classList.remove("hidden");
    btn.dataset.loading = "false";
    btn.innerHTML = originalLabel;
  }
});
