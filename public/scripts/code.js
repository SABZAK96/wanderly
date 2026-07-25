async function loadTrips() {
  const data = await (await fetch("/allTrips")).json();
  const container = document.getElementById("addedTrips");
  container.innerHTML = "";
  data.forEach((trip) => {
    const startDate = trip.startDate.slice(0, 10); // gives sth like 2017-08-19
    const endDate = trip.endDate.slice(0, 10);
    const dateRange = formatTripDates(startDate, endDate);
    let element = "";
    element += `<div data-id ="${trip._id}"
                class="card suggest flex flex-row items-center justify-between gap-2 text-sm font-medium  px-2.5 py-2 rounded-xl hover:cursor-pointer hover:border-2 hover:border-[#3c3489] text-[#3c3489] bg-[#eeedfe]"
              >
                <span>${trip.destination.charAt(0).toUpperCase() + trip.destination.slice(1)}</span
                ><span class="text-xs font-normal"
                  >${dateRange.compact}</span
                >
              </div>`;
    container.insertAdjacentHTML("beforeend", element);
  });
}

// force the user to pick a trip first - see notes/suggest-modal-trip-picker.md
const suggestModal = document.getElementById("my_modal_suggest");
document.getElementById("mode-suggestions").addEventListener("change", () => {
  if (!localStorage.getItem("selectedTripId")) {
    loadTrips().then(() => suggestModal.showModal());
  }
});

// listen to the custom event created in the sidebar- so if the trip is deleted and the user is on the suggestion mode, ask for the modal again
document.addEventListener("tripDeleted", () => {
  //these modes don't exist on all pages, we should check for the existance
  if (
    document.getElementById("mode-suggestions") &&
    document.getElementById("mode-suggestions").checked
  ) {
    loadTrips().then(() => suggestModal.showModal());
  }
});

// if the modal is closed and no trip is selected, switch back to ask AI
suggestModal.addEventListener("close", () => {
  if (!localStorage.getItem("selectedTripId")) {
    document.getElementById("mode-ai").checked = true;
  }
});

// open up the add a new trip modal once create a new trip button in modal_suggest is clicked
suggestModal.addEventListener("click", (event) => {
  const btn = event.target.closest("#createTripinPickModal");
  if (!btn) return; // click was somewhere else in the modal (close button, backdrop, a trip card)
  document.getElementById("my_modal_trip").showModal();
  suggestModal.close();
});

// saving newly added trip to local storage will be handled in sidebar.js - the following block handles selecting from the modal
suggestModal.addEventListener("click", (event) => {
  // remove all the borders first
  suggestModal.querySelectorAll(".suggest").forEach((element) => {
    element.classList.contains("border-2") &&
      element.classList.remove("border-2");
  });
  const selectedTrip = event.target.closest(".suggest");
  if (!selectedTrip) return;

  selectedTrip.classList.add("border-2", "border-[#3c3489]");
  localStorage.setItem("selectedTripId", selectedTrip.dataset.id);
  // create a custom event so sidebar can catch it and update itself
  document.dispatchEvent(
    new CustomEvent("addTripSuggest", {
      detail: { tripId: selectedTrip.dataset.id },
    }),
  );
  suggestModal.close();
});

// ==============================================================================
// logic for connecting suggestion mode to the google places api
// ==============================================================================
const msg = document.getElementById("suggError");
const suggestionInput = document.getElementById("suggestionSearch");
document.getElementById("searchSuggest").addEventListener("click", async () => {
  msg.textContent = "";
  const query = suggestionInput.value;
  if (query.trim() === "") {
    msg.textContent = "* Please enter a search term.";
    return;
  } else {
    const destination = document.getElementById("destName").textContent;
    const finalQuery = query + " in " + destination;
    await googleSuggestion(finalQuery);
  }
});

// clear the error when user starts typing again
suggestionInput.addEventListener("input", () => {
  msg.textContent = "";
});

// sends the constructed "<search term> in <destination>" query to our own
// /googleAPI proxy, which forwards it to Google Places Text Search
// (fetch function only - no DOM/rendering here)
async function googleSuggestion(query) {
  const response = await fetch(`/googleAPI`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userQuery: query }),
  });
}
