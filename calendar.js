      
    //   this code block is obtained from https://fullcalendar.io/docs/initialize-globals for initializing the FullCalendar
      document.addEventListener('DOMContentLoaded', function() {
        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth'
        });
        calendar.render();
      });