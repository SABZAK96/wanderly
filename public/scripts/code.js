// force the user to pick a trip first - loadTrips/requireTripSelected/
// suggestModal now live in sidebar.js (shared with calendar.js/expense.js)
// - see notes/suggest-modal-trip-picker.md
document.getElementById("mode-suggestions").addEventListener("change", () => {
  requireTripSelected();
});

// listen to the custom event created in the sidebar- so if the trip is deleted and the user is on the suggestion mode, ask for the modal again
document.addEventListener("tripDeleted", () => {
  //these modes don't exist on all pages, we should check for the existance
  if (
    document.getElementById("mode-suggestions") &&
    document.getElementById("mode-suggestions").checked
  ) {
    requireTripSelected();
  }
});

// if the modal is closed and no trip is selected, switch back to ask AI
suggestModal.addEventListener("close", () => {
  if (!localStorage.getItem("selectedTripId")) {
    document.getElementById("mode-ai").checked = true;
  }
});

// ==============================================================================
// logic for connecting suggestion mode to the google places api
// ==============================================================================
const msg = document.getElementById("suggError");
const emptySuggestionContainer = document.getElementById("emptySuggestion");
let finalQuery;
let builtResults = [];
let nextPageToken;

const suggestionInput = document.getElementById("suggestionSearch");
document.getElementById("searchSuggest").addEventListener("click", async () => {
  msg.textContent = "";
  const query = suggestionInput.value;
  if (query.trim() === "") {
    msg.textContent = "* Please enter a search term.";
    return;
  } else {
    emptySuggestionContainer.classList.add("hidden");
    const destination = document.getElementById("destName").textContent;
    finalQuery = query + " in " + destination;
    builtResults = [];
    document.getElementById("suggestionContainer").innerHTML = "";
    // a fresh search resets the filter/sort pills back to All/no-sort too
    // (buildFilters, called from googleSuggestion) - clear the trigger
    // highlight left over from whatever was active on the previous search
    setTriggerActive(filterTrigger, false);
    setTriggerActive(sortTrigger, false);
    nextPageToken = await googleSuggestion(finalQuery, "");
    // toggle's 2nd arg (force) sets the class to exactly that boolean instead of flipping it - see notes/classlist-toggle-force.md
    loadMoreWrap.classList.toggle("hidden", !nextPageToken);
  }
});

// attaching a listener on the load more button - fetches and appends the next page of results
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMore");
loadMoreBtn.addEventListener("click", async () => {
  // no more results to fetch - don't send an empty token (Google treats
  // that as "start over from page 1")
  if (!nextPageToken) return;

  // googleSuggestion calls buildFilters, which rebuilds the pills from
  // scratch (back to All/no-sort) - grab what's actually checked now,
  // before that reset wipes it
  const prevFilterLabel = document.querySelector(
    "#filterContainer input:checked",
  )?.ariaLabel;
  const prevSortLabel = document.querySelector(
    "#sortContainer input:checked",
  )?.ariaLabel;

  nextPageToken = await googleSuggestion(finalQuery, nextPageToken);

  // re-check whichever freshly-built pill matches what was active before
  // the fetch reset them, so the UI and the re-render agree
  const filterBtn = [...document.querySelectorAll("#filterContainer input")]
    .find((el) => el.ariaLabel === prevFilterLabel);
  const sortBtn = [...document.querySelectorAll("#sortContainer input")].find(
    (el) => el.ariaLabel === prevSortLabel,
  );
  if (filterBtn) filterBtn.checked = true;
  if (sortBtn) sortBtn.checked = true;
  if (filterBtn || sortBtn) buildFilteredResults(filterBtn, sortBtn);

  loadMoreWrap.classList.toggle("hidden", !nextPageToken);
});
// clear the error when user starts typing again
suggestionInput.addEventListener("input", () => {
  msg.textContent = "";
  // only bring the empty-state graphic back if there's no existing
  // results grid still on screen - otherwise it'd stack on top of it
  const filters = document.getElementById("filterContainer");
  if (filters.classList.contains("hidden")) {
    emptySuggestionContainer.classList.remove("hidden");
  }
});

// desgin the most popular filter pill using IMDB weighted method for showing top 250 popular movies - reference note: most-popular-filter-design.md
function weightedRating(item, allItems, m) {
  // API might not return some data - we filter them out
  const reviewedItems = allItems.filter(
    (candidate) => candidate.rating != null,
  );

  // formula = (v / (v + m)) * R + (m / (v + m)) * C

  // calculate c - average rating across the current result set
  const setSumRating = reviewedItems.reduce(
    (sum, element) => sum + element.rating,
    0,
  );

  const c =
    reviewedItems.length !== 0 ? setSumRating / reviewedItems.length : 0;

  // calculating v - the place's own review count
  const v = item.userRatingCount ?? 0;

  // calculating r - the place's own average rating
  const r = item.rating ?? c; // no rating at all -> fall back to the set average

  const score = (v / (v + m)) * r + (m / (v + m)) * c;
  return score;
}

// sends the constructed "<search term> in <destination>" query to our own
// /googleAPI proxy, which forwards it to Google Places Text Search
// (fetch function only - no DOM/rendering here)

async function googleSuggestion(query, token) {
  const errorMsg = document.getElementById("suggError");
  errorMsg.textContent = "";

  // bias results toward the trip's actual coordinates - the destination
  // name in the query is trusted (came from Places autocomplete, not
  // user input), but the user's own search term isn't, so this keeps
  // sloppy/generic search terms from ranking a far-away match highly
  const tripHeader = document.getElementById("tripHeader");
  const lat = tripHeader.dataset.lat;
  const lng = tripHeader.dataset.lng;

  const response = await fetch(`/googleAPI`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userQuery: query, nextToken: token, lat, lng }),
  });

  if (response.ok) {
    const data = await response.json();
    const rendered = await renderSuggestions(data);
    builtResults = [...builtResults, ...rendered];
    buildFilters(builtResults);

    nextPageToken = data.nextPageToken;
    return nextPageToken;
  } else {
    errorMsg.textContent = "Could not Fetch Data. Try Again.";
    errorMsg.classList.remove("hidden");
    emptySuggestionContainer.classList.remove("hidden");
    return;
  }
}

// this function renders the result that comes from the google API
async function renderSuggestions(data) {
  let newResults = [];
  const container = document.getElementById("suggestionContainer");

  if (!data.places || data.places.length === 0) {
    msg.textContent = "No results found. Try a different search.";
    emptySuggestionContainer.classList.remove("hidden");
    return newResults;
  }

  // show the filters
  const filters = document.getElementById("filtersRow");
  filters.classList.contains("hidden") && filters.classList.remove("hidden");

  // photos come back as a resource name, not a URL - need our own key
  // (same one already used for the Autocomplete widget) to build the
  // actual Photo media URL
  const { key } = await (await fetch("/config/places-key")).json();

  data.places.forEach((item) => {
    const startPrice = item.priceRange?.startPrice?.units
      ? Number(item.priceRange.startPrice.units)
      : 0;
    const endPrice = item.priceRange?.endPrice?.units
      ? Number(item.priceRange.endPrice.units)
      : 0;
    // used for the price: low-high/high-low filter pills - stashed as data-weighted-price so no-price cards (0) can be pushed to the end
    const averagePrice = (startPrice + endPrice) / 2;

    // used for the Most Popular filter pill - stashed as data-weighted-average, see notes/most-popular-filter-design.md
    const weightedAverage = weightedRating(item, data.places, 30);

    const photoUrl =
      item.photos && item.photos[0]
        ? `https://places.googleapis.com/v1/${item.photos[0].name}/media?maxHeightPx=400&key=${key}`
        : null;

    let element = `<div data-weighted-price="${averagePrice}" data-weighted-average="${weightedAverage}" data-id="${item.id}" data-lat="${item.location.latitude}" data-lng="${item.location.longitude}" data-address="${item.formattedAddress}" class="parent card bg-base-100 shadow-sm border border-base-200 h-full">
                ${
                  photoUrl
                    ? `<figure class="relative">
                  <img
                    src="${photoUrl}"
                    alt="${item.displayName.text}"
                    class="w-full h-44 object-cover"
                  />

                </figure>`
                    : ""
                }
                <div class="card-body p-4 gap-2">
                  <div class="flex items-start justify-between gap-2">
                    <h2
                      class="card-title text-sm font-medium leading-tight"
                      style="color: #3c3489"
                    >
                      ${item.displayName.text}
                    </h2>
                    ${
                      item.rating && item.userRatingCount
                        ? `<div class="flex items-center gap-0.5 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="#854F0B"
                        class="size-3.5"
                      >
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                      </svg>
                      <div class="text-xs flex flex-row gap-1 items-center" style="color: #854f0b">
                        <span >${item.rating}</span> (<span>${item.userRatingCount.toLocaleString()} reviews</span>)
                      </div>

                    </div>`
                        : ""
                    }
                  </div>
                  ${
                    item.editorialSummary
                      ? `<p
                    class="text-xs text-base-content/60 leading-relaxed line-clamp-2"
                  >
                    ${item.editorialSummary.text}
                  </p>`
                      : ""
                  }
                  <div class="flex flex-col gap-1.5 mt-1">
                    ${
                      item.priceRange?.startPrice && item.priceRange?.endPrice
                        ? `<div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6 6h.008v.008H6V6Z"
                        />
                      </svg>
                      <span class="text-xs text-base-content/70"
                        >${item.priceRange.startPrice.currencyCode} ${item.priceRange.startPrice.units}-${item.priceRange.endPrice.units} / person</span
                      >
                    </div>`
                        : ""
                    }
                    ${
                      item.primaryType
                        ? `<div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
                        />
                      </svg>
                      <span data-type="${item.primaryType}" class="text-xs text-base-content/70"
                        >${item.primaryType.replaceAll("_", " ")}</span
                      >
                    </div>`
                        : ""
                    }
                    <div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                        />
                      </svg>
                      <span class="text-xs text-base-content/70"
                        >${item.formattedAddress}</span
                      >
                    </div>
                    ${
                      item.regularOpeningHours
                        ? `<div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                      </svg>
                      <span class="text-xs text-base-content/70"
                        >${item.regularOpeningHours.openNow ? "Open Now" : "Closed"}</span
                      >
                    </div>`
                        : ""
                    }
                    ${
                      item.websiteUri
                        ? `<div class="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="#534AB7"
                        class="size-4 shrink-0"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
                        />
                      </svg>
                      <a
                        href="${item.websiteUri}"
                        target="_blank"
                        class="text-xs text-base-content/70 truncate"
                        style="color: #534ab7"
                        >Visit Website</a
                      >
                    </div>`
                        : ""
                    }
                  </div>
                  <div class="card-actions justify-end mt-auto">
                    <button
                      class=" addToCal btn btn-sm text-white text-xs font-medium gap-1.5"
                      style="background: #534ab7; border: none"
                      onmouseover="this.style.background = '#3C3489'"
                      onmouseout="this.style.background = '#534AB7'"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
                        />
                      </svg>
                      Add to calendar
                    </button>
                  </div>
                </div>
              </div>`;
    container.insertAdjacentHTML("beforeend", element);
    // buildFilters needs a real DOM node (to call .querySelector on), not the HTML string used to insert it
    newResults.push(container.lastElementChild);
  });
  return newResults;
}

// attaching listener to all add to calendar buttons in suggestion section -using delegation
const calModal = document.getElementById("my_modal_calendar");
const title = document.getElementById("activityTitle");
const calError = document.getElementById("addToCalError");
document.getElementById("non-AI").addEventListener("click", (event) => {
  const btn = event.target.closest(".addToCal");
  if (!btn) return;

  title.textContent = btn
    .closest(".parent")
    .querySelector(".card-title").textContent;

  // stash the card's place data on the modal so the Add button can read it later
  calModal.dataset.placeId = btn.closest(".parent").dataset.id;
  calModal.dataset.lat = btn.closest(".parent").dataset.lat;
  calModal.dataset.lng = btn.closest(".parent").dataset.lng;
  calModal.dataset.address = btn.closest(".parent").dataset.address;

  // fill out the date - defaults to the first day of the trip
  cleanUpCalendarModal();
  const date = document.getElementById("tripHeader").dataset.startDate;
  document.getElementById("startDateCal").value = date;
  calModal.showModal();
});

// resets the add-to-calendar modal's time inputs and radio selection so stale values from a previous activity don't leak into the next one
function cleanUpCalendarModal() {
  const startTime = document.getElementById("startTime");
  const endTime = document.getElementById("endTime");
  const soloActivity = document.getElementById("solo");
  soloActivity.checked = true;
  startTime.value = "";
  endTime.value = "";
}
// submitting the add to calendar
const addToCalBtn = document.getElementById("addToCal");
addToCalBtn.addEventListener("click", async () => {
  const originalBtnContent = addToCalBtn.textContent;
  if (addToCalBtn.dataset.loading === "true") return;

  calError.textContent = "";
  calError.classList.add("hidden");
  const startTime = document.getElementById("startTime").value;
  const endTime = document.getElementById("endTime").value;
  const errorMessage = validateTripDates(
    undefined,
    undefined,
    undefined,
    startTime,
    endTime,
  );
  if (errorMessage) {
    calError.textContent = errorMessage;
    calError.classList.remove("hidden");
    return;
  }

  // startDateCal is prefilled from the trip's own start date, but the user can still change it - make sure it stays within the trip's date range
  const activityDate = document.getElementById("startDateCal").value;
  const tripHeader = document.getElementById("tripHeader");
  if (
    activityDate < tripHeader.dataset.startDate ||
    activityDate > tripHeader.dataset.endDate
  ) {
    calError.textContent = "Date must be within the trip's dates.";
    calError.classList.remove("hidden");
    return;
  }

  addToCalBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
  addToCalBtn.dataset.loading = "true";

  try {
    // possibly new date input
    const dateInput = document.getElementById("startDateCal").value;

    // different routes based on user radio selection
    const soloActivity = document.getElementById("solo");
    const tripId = localStorage.getItem("selectedTripId");
    if (soloActivity.checked) {
      const response = await fetch(`/addToCalSolo/${tripId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityName: title.textContent,
          date: dateInput,
          startTime: startTime,
          endTime: endTime,
          address: calModal.dataset.address,
          placeId: calModal.dataset.placeId,
          location: { lat: calModal.dataset.lat, lng: calModal.dataset.lng },
        }),
      });
      if (!response.ok) {
        calError.textContent = await response.text();
        calError.classList.remove("hidden");
      } else {
        calModal.close();
        getRecentActivities(tripId);
      }
    } else {
      const response = await fetch(`/addToCalgrp/${tripId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activityName: title.textContent,
          date: dateInput,
          startTime: startTime,
          endTime: endTime,
          address: calModal.dataset.address,
          placeId: calModal.dataset.placeId,
          location: { lat: calModal.dataset.lat, lng: calModal.dataset.lng },
        }),
      });
      if (!response.ok) {
        calError.textContent = await response.text();
        calError.classList.remove("hidden");
      } else {
        calModal.close();
        getRecentActivities(tripId);
      }
    }
    // handle network errors - if fetch throws(the request never got a response at all) - the other !response.ok check http request throws
  } catch (error) {
    calError.textContent = "Could not reach the server. Try again.";
    calError.classList.remove("hidden");
  } finally {
    addToCalBtn.textContent = originalBtnContent;
    addToCalBtn.dataset.loading = "false";
  }
});
