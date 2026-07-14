document.getElementById("addTrip").addEventListener("click", () => {
  document.getElementById("my_modal_trip").showModal();
});

document.getElementById("inviteTrip").addEventListener("click", () => {
  document.getElementById("inviteModal").showModal();
});

// get the data from submitted modal
document.getElementById("createTrip").addEventListener("click", async () => {
  // validating inputs to be non empty
  const destination = document.getElementById("dest-title").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  // get todays date in yyyy-mm-dd format
  const todayDate = new Date().toISOString().slice(0, 10);

  const tripError = document.getElementById("tripError");
  tripError.classList.add("hidden");

  if (destination.trim() === "") {
    tripError.textContent = "Please Enter your destination.";
    tripError.classList.remove("hidden");
    return;
  } else if (!startDate || !endDate) {
    tripError.textContent = "Please select both a start and end date.";
    tripError.classList.remove("hidden");
    return;
  } else if (endDate <= startDate) {
    tripError.textContent = "End date must be after the start date.";
    tripError.classList.remove("hidden");
    return;
  } else if (startDate < todayDate) {
    tripError.textContent = "Start date can't be in the past.";
    tripError.classList.remove("hidden");
    return;
  } 

  // sending the info to db
    const response = await fetch("/addTrip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        destination: destination,
        startDate: startDate,
        endDate: endDate,
      }),
    });
  if (response.ok){
    const data = await response.json();
    document.getElementById("inviteModal").showModal();
    document.getElementById("link").value = `${window.location.origin}/join.html?trip=${data}`
  }
  else {
    tripError.textContent = "Could not add the trip, please try again.";
    tripError.classList.remove("hidden");
  }
});
