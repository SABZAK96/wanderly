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
      document.getElementById("tripInviter").textContent = urlInfo.inviter;
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

