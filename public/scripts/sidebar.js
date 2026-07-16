// fetching the user info for their Id to build peronalized invitation links
let myId;
async function getMyId() {
  if (!myId) {
    const me = await (await fetch("/userInfo")).json();
    myId = me.id;
  }
  return myId;
}

document.getElementById("addTrip").addEventListener("click", () => {
  // clear any leftover edit state so this opens as a fresh "create" form
  const modal = document.getElementById("my_modal_trip");
  delete modal.dataset.editingTripId;
  document.getElementById("tripTitle").textContent = "Add a New Trip";
  document.getElementById("createTrip").textContent = "Create Trip";
  document.getElementById("dest-title").value = "";
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  modal.showModal();
});

// checks destination/date inputs for create and edit trip forms, returns an
// error message to show the user or null if everything's valid
function validateTripDates(destination, startDate, endDate) {
  // get todays date in yyyy-mm-dd format
  const todayDate = new Date().toISOString().slice(0, 10);

  if (destination.trim() === "") {
    return "Please Enter your destination.";
  } else if (!startDate || !endDate) {
    return "Please select both a start and end date.";
  } else if (endDate <= startDate) {
    return "End date must be after the start date.";
  } else if (startDate < todayDate) {
    return "Start date can't be in the past.";
  }
  return null;
}

// get the data from submitted modal
document
  .getElementById("createTrip")
  .addEventListener("click", async (event) => {
    const destination = document.getElementById("dest-title").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    const tripError = document.getElementById("tripError");
    tripError.classList.add("hidden");

    const errorMessage = validateTripDates(destination, startDate, endDate);
    if (errorMessage) {
      tripError.textContent = errorMessage;
      tripError.classList.remove("hidden");
      return;
    }

    const btn = event.currentTarget;
    if (btn.dataset.loading === "true") return; // guard against double-click

    const originalLabel = btn.innerHTML;
    btn.dataset.loading = "true";
    btn.innerHTML = `<span class="loading loading-dots loading-sm"></span>`;

    const modal = document.getElementById("my_modal_trip");
    const editingTripId = modal.dataset.editingTripId;

    if (editingTripId) {
      // editing an existing trip
      const response = await fetch(`/editTrip/${editingTripId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination: destination,
          startDate: startDate,
          endDate: endDate,
        }),
      });

      if (response.ok) {
        delete modal.dataset.editingTripId;
        modal.close();
        // getSingleTripDetails (renders #tripHeader) only exists on plan.html,
        // which is the only page editing a trip can currently be triggered from
        if (typeof getSingleTripDetails === "function") {
          await getSingleTripDetails(editingTripId);
        }
        await loadYourTrips();
      } else {
        tripError.textContent = "Could not update the trip, please try again.";
        tripError.classList.remove("hidden");
      }

      btn.dataset.loading = "false";
      btn.innerHTML = originalLabel;
      return;
    }

    // creating a new trip
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
    if (response.ok) {
      const data = await response.json();

      // clear the form so the next "+ New Trip" opens blank, not with this trip's info
      document.getElementById("dest-title").value = "";
      document.getElementById("startDate").value = "";
      document.getElementById("endDate").value = "";

      // close the previous modal
      modal.close();
      // show the invite link after trip was submitted successfully - #inviteModal
      // only exists on plan.html, so skip this on pages that don't have it
      const inviteModal = document.getElementById("inviteModal");
      if (inviteModal) {
        inviteModal.showModal();
        document.getElementById("link").value =
          `${window.location.origin}/join.html?trip=${data}&from=${await getMyId()}`;
      }
      loadYourTrips();
    } else {
      tripError.textContent = "Could not add the trip, please try again.";
      tripError.classList.remove("hidden");
    }

    btn.dataset.loading = "false";
    btn.innerHTML = originalLabel;
  });

// loading "your trips" in the side bar
async function loadYourTrips() {
  const data = await (await fetch("/allTrips")).json();
  const container = document.getElementById("yourTrips");
  container.innerHTML = "";
  data.forEach((trip) => {
    const startDate = trip.startDate.slice(0, 10); // gives sth like 2017-08-19
    const endDate = trip.endDate.slice(0, 10);
    const dateRange = formatTripDates(startDate, endDate);
    let element = "";
    element += `<div id ="${trip._id}"
                class="trip flex flex-row items-center justify-between gap-2 text-sm font-medium text-white px-2.5 py-2 rounded-xl hover:cursor-pointer hover:bg-[rgba(255,255,255,0.08)]"
              >
                <span>${trip.destination.charAt(0).toUpperCase() + trip.destination.slice(1)}</span
                ><span class="text-xs font-normal text-white/70"
                  >${dateRange.compact}</span
                >
              </div>`;
    container.insertAdjacentHTML("beforeend", element);
  });
}

loadYourTrips();

// highlights the clicked trip in the sidebar and un-highlights the rest
async function yourTripsStyle(event) {
  const element = event.target.closest(".trip");
  if (!element) return;

  // clear the style of bg of other elements if they exist
  const otherElements = [
    ...element.closest("#yourTrips").querySelectorAll(".trip"),
  ];
  otherElements.map((element) => (element.style.background = "transparent"));
  // add a bg color to selected trip
  element.style.background = "rgba(255, 255, 255, 0.16)";

  return element;
}
document
  .getElementById("yourTrips")
  .addEventListener("click", async (event) => {
    const element = await yourTripsStyle(event);
    if (!element) return;
    // getSingleTripDetails (renders #tripHeader) only exists on plan.html
    if (typeof getSingleTripDetails === "function") {
      await getSingleTripDetails(element.id);
    }
  });
