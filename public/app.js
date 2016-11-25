$(document).ready(function(){
  function goSync() {
    $.get('/sync', function() {
      $('.sync').css('color', 'green');
    });
  }
  $('nav ul').prepend('<li><a class="sync"><i class="fa fa-spin fa-refresh" aria-hidden="true"></i> Sync</a></li>')
  $('.sync').on('click', function(e) {
    e.preventDefault();
    goSync();
  });
  var db = new PouchDB('searches');
  var client = algoliasearch(appId, apiKey);
  function searchAlgolia (searchTerm){
    var index = client.initIndex(indexId);
    index.search(searchTerm, function searchDone(err, content) {
      if (err) {
        console.log(err);
        goSync();
      } else {
        $('#result').html('');
        content.hits.forEach(function(contact) {
          var name = contact._highlightResult.name.value;
          var emailArray = [];
          var tel = [];
          contact.email.forEach(function(email, key) {
            console.log(email, key);
            emailArray.push(`<a href="mail:${email}" >${contact._highlightResult.email[key].value}</a>`)
          });
          contact.phone.forEach(function(phone, key) {
            tel.push(`<a href="${phone}" >${contact._highlightResult.phone[key].value}</a>`)
          });
          $('#result').append(`<li class="collection-item avatar">
            <img src="${contact.image}" alt="" class="circle">
            <span class="title">${name}</span>
            <p>
              ${emailArray.join(', ')} <br>
               ${tel.join(', ')}
            </p>
          </li>`);
        });
        var returnedHits = {
          _id: searchTerm,
          hits: content.hits
        };
        db.get(searchTerm, function(err, result) {
          if(!err) {
            returnedHits._rev = result._rev;
          }
          db.put(returnedHits, function (err, result) {
            if (err) {
              console.error(err);
            }
          });
        });
      }
    });
  }
  $('#search').on('keyup', function() {
    var searchTerm = $('#search').val();;
    if ('onLine' in navigator) {
      if (navigator.onLine) {
        searchAlgolia(searchTerm);
      } else {
        db.get(searchTerm, function(err, result) {
          $('#result').html('');
          result.hits.forEach(function(contact) {
            var name = contact._highlightResult.name.value;
            var emailArray = [];
            var tel = [];
            contact.email.forEach(function(email, key) {
              console.log(email, key);
              emailArray.push(`<a href="mail:${email}" >${contact._highlightResult.email[key].value}</a>`)
            });
            contact.phone.forEach(function(phone, key) {
              tel.push(`<a href="${phone}" >${contact._highlightResult.phone[key].value}</a>`)
            });
            $('#result').append(`<li class="collection-item avatar">
              <img src="${contact.image}" alt="" class="circle">
              <span class="title">${name}</span>
              <p>
                ${emailArray.join(', ')} <br>
                 ${tel.join(', ')}
              </p>
            </li>`);
          });
        });
      }
    } else {
      searchAlgolia(searchTerm);
    }
  })
});
