const create_trip = {
  name: "create_trip",
  description:
    "Creates a new trip for the current user and returns its id. Use when the user asks to plan/add/start a new trip and has given a destination and dates. lat/lng must come from resolving destination through Places first — never invent coordinates. " +
    "Returns just the new trip's _id as a plain string (not wrapped in an object) — use it as the tripId for subsequent calls on this trip.",
  input_schema: {
    type: "object",
    properties: {
      destination: { type: "string" },
      destinationName: { type: "string" },
      startDate: { type: "string", description: "YYYY-MM-DD" },
      endDate: { type: "string", description: "YYYY-MM-DD" },
      lat: { type: "number" },
      lng: { type: "number" },
    },
    required: [
      "destination",
      "destinationName",
      "startDate",
      "endDate",
      "lat",
      "lng",
    ],
  },
};

const get_weather_forecast = {
  name: "get_weather_forecast",
  description:
    "Calls the Google Weather API for a 10-day forecast for a location. Use when suggesting packing list items or activities for a trip that starts within 10 days. No data is available beyond that — say so rather than guessing if the trip is further out. lat/lng are the trip's own stored coordinates — never invent them. " +
    "Returns { forecastDays: [ { maxTemperature: { degrees }, minTemperature: { degrees }, daytimeForecast: { weatherCondition: { description: { text } }, precipitation: { probability: { percent } }, wind: { speed: { value }, direction: { cardinal } } }, nighttimeForecast: {...same shape as daytimeForecast...} } ] } — read weatherCondition.description.text for conditions, not raw codes.",
  input_schema: {
    type: "object",
    properties: {
      lat: { type: "number" },
      lng: { type: "number" },
    },
    required: ["lat", "lng"],
  },
};

const get_current_weather = {
  name: "get_current_weather",
  description:
    "Calls the Google Weather API for today's current conditions at a location — right now, not a forecast. Use when the user asks what the weather is like today/right now, not when planning future days. lat/lng are the trip's own stored coordinates — never invent them. " +
    "Returns { weatherCondition: { description: { text } }, temperature: { degrees }, feelsLikeTemperature: { degrees }, relativeHumidity, uvIndex, precipitation: { probability: { percent } }, wind: { speed: { value }, direction: { cardinal } } } — read weatherCondition.description.text for conditions, not raw codes.",
  input_schema: {
    type: "object",
    properties: { lat: { type: "number" }, lng: { type: "number" } },
    required: ["lat", "lng"],
  },
};

const add_activity_group = {
  name: "add_activity_group",
  description:
    "Adds an activity to the calendar for every member of the current trip. Use when the user asks to add a group activity. Will be rejected if the date falls outside the trip's date range — relay that rejection to the user rather than retrying with a different date. " +
    "Returns the created activity on success: { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } — save _id as the activityId edit_activity/delete_activity_group/delete_activity_solo need. Returns { error } instead if rejected.",
  input_schema: {
    type: "object",
    properties: {
      activityName: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      startTime: { type: "string", description: "HH:MM, 24-hour" },
      endTime: { type: "string", description: "HH:MM, 24-hour" },
      address: { type: "string" },
      placeId: { type: "string" },
      location: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lng: { type: "number" },
        },
        required: ["lat", "lng"],
      },
    },
    required: [
      "activityName",
      "date",
      "startTime",
      "endTime",
      "address",
      "placeId",
      "location",
    ],
  },
};

const add_activity_solo = {
  name: "add_activity_solo",
  description:
    "Adds an activity to the calendar for only the user. Use when the user asks to add an activity only for themselves. Will be rejected if the date falls outside the trip's date range — relay that rejection to the user rather than retrying with a different date. " +
    "Returns the created activity on success: { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location } — save _id as the activityId edit_activity/delete_activity_group/delete_activity_solo need. Returns { error } instead if rejected.",
  input_schema: {
    type: "object",
    properties: {
      activityName: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      startTime: { type: "string", description: "HH:MM, 24-hour" },
      endTime: { type: "string", description: "HH:MM, 24-hour" },
      address: { type: "string" },
      placeId: { type: "string" },
      location: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lng: { type: "number" },
        },
        required: ["lat", "lng"],
      },
    },
    required: [
      "activityName",
      "date",
      "startTime",
      "endTime",
      "address",
      "placeId",
      "location",
    ],
  },
};

const list_trips = {
  name: "list_trips",
  description:
    "Returns all of the current user's trips (id, destination, destinationName, startDate, endDate, lat, lng). Use when no trip is selected and you need to offer a pick-list, or to resolve a trip name the user mentioned to its id.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};
const search_places = {
  name: "search_places",
  description:
    "Searches Google Places for real venues matching a query, biased toward the trip's location. Use this to find actual, addable candidates for an itinerary (it's the source of the placeId/location that add_activity_group/add_activity_solo require). Phrase userQuery the way a manual search would, e.g. 'museums in Lisbon', not just 'museums'. lat/lng are the trip's own stored coordinates — never invent them. Pass nextToken only to fetch more results for the same userQuery/lat/lng after an earlier call returned one. " +
    "Returns { places: [ { id, displayName: { text }, formattedAddress, location: { latitude, longitude }, priceLevel, priceRange: { startPrice, endPrice }, rating, userRatingCount, primaryType, editorialSummary: { text }, regularOpeningHours: { periods, weekdayDescriptions }, photos: [ { name, widthPx, heightPx } ], websiteUri } ], nextPageToken } — id is the placeId and location is the {lat,lng} that add_activity_group/add_activity_solo need; primaryType is a plain string, not an object. Pass nextPageToken back in as nextToken to page further. " +
    "This is the ONLY source for rating, userRatingCount, priceLevel/priceRange, and editorialSummary — treat those as ground truth from Google, and never state a rating, price, or summary you didn't get from this result. It does NOT include individual reviews/opinions, ticket prices/requirements, visit duration, or popularity — those aren't in this response at all, so never infer or estimate them from priceLevel/priceRange/rating. Before recommending or scheduling a candidate that plausibly needs a ticket or booking, proactively call web_search on its websiteUri (when present) for current pricing and entry requirements, and separately web_search for its typical visit duration and popularity — don't wait for the user to ask. If a search doesn't surface it, say you couldn't confirm it rather than guessing.",
  input_schema: {
    type: "object",
    properties: {
      userQuery: { type: "string" },
      lat: { type: "number" },
      lng: { type: "number" },
      nextToken: {
        type: "string",
        description:
          "From a previous search_places result's nextPageToken, to page further into the same search.",
      },
    },
    required: ["userQuery", "lat", "lng"],
  },
};

const edit_activity = {
  name: "edit_activity",
  description:
    "Updates an already-added activity's date and/or time. date is optional — omit it for a time-only change (e.g. moving the start/end time without changing the day). If date is included, it must fall within the trip's date range or the call will be rejected — relay that rejection to the user rather than retrying with a different date. " +
    "Returns the updated activity on success: { _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location }. Returns { error } instead if rejected (invalid date, bad time range, or not a member of the activity's trip).",
  input_schema: {
    type: "object",
    properties: {
      activityId: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      startTime: { type: "string", description: "HH:MM, 24-hour" },
      endTime: { type: "string", description: "HH:MM, 24-hour" },
    },
    required: ["activityId", "startTime", "endTime"],
  },
};

const delete_activity_solo = {
  name: "delete_activity_solo",
  description:
    "Removes only the current user from an activity's participants. If they were the last participant, the activity is deleted entirely; otherwise it stays on the calendar for everyone else still on it. Use when the user wants to remove themselves from an activity without affecting other trip members. " +
    "Returns the activity as it stood right after removal ({ _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location }, with the user no longer in participants) so you have something to reference when confirming to the user, or { error } if the activity doesn't exist or they're not a member.",
  input_schema: {
    type: "object",
    properties: {
      activityId: { type: "string" },
    },
    required: ["activityId"],
  },
};

const delete_activity_group = {
  name: "delete_activity_group",
  description:
    "Permanently deletes an activity for every participant, regardless of who added it. Use only when the user confirms they want it removed for the whole group, not just themselves — this cannot be undone. " +
    "Returns the now-deleted activity ({ _id, tripId, participants, activityName, date, startTime, endTime, address, placeId, location }) so you have something to reference when telling the user what got deleted, or { error } if it doesn't exist or they're not a member.",
  input_schema: {
    type: "object",
    properties: {
      activityId: { type: "string" },
    },
    required: ["activityId"],
  },
};

const list_activities = {
  name: "list_activities",
  description:
    "Returns all of the current user's own activities on this trip's calendar ({ _id, activityName, date, startTime, endTime, address, placeId, location } each) — not other trip members' activities. _id is the activityId that edit_activity/delete_activity_solo/delete_activity_group need. Use when you need the user's schedule, especially before suggesting a packing list.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};
const add_packing_items = {
  name: "add_packing_items",
  description:
    "Adds a batch of items to one category of the user's packing list for this trip. Come up with the suggested items yourself first (using list_activities and get_weather_forecast — generic essentials, weather-driven items, and activity-driven items) and get the user's confirmation before calling this. category must be one of the trip's existing categories: 'Documents & Essentials', 'Weather Essentials', 'Planned Activities', 'Toiletries & Health' — call this once per category, not all four at once. " +
    "Returns the user's full updated packing list doc: { packingList: [ { category, items: [ { title } ] } ] } across all categories, not just the one just updated.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
        },
      },
    },
    required: ["category", "items"],
  },
};

// search_web — Anthropic's built-in web_search tool, not a custom one. No
// input_schema to design
const search_web = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 15,
};

module.exports = [
  create_trip,
  list_trips,
  search_places,
  get_weather_forecast,
  get_current_weather,
  add_activity_solo,
  add_activity_group,
  edit_activity,
  delete_activity_solo,
  delete_activity_group,
  list_activities,
  add_packing_items,
  search_web,
];
