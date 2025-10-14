describe('Navigation', function() {
  this.timeout(5000);
  let frame;
  let doc;

  before(function(done) {
    frame = document.getElementById('app');
    frame.addEventListener('load', function onload() {
      frame.removeEventListener('load', onload);
      doc = frame.contentDocument;
      // slight delay for scripts to initialize
      setTimeout(done, 100);
    });
  });

  function getHeading() {
    return doc.querySelector('main h2').textContent.trim();
  }

  it('replaces <main> content for each link', function(done) {
    const expected = ['Home', 'About', 'Works', 'Log', 'Links'];
    const links = doc.querySelectorAll('nav a');
    const seen = [getHeading()];
    let i = 1;
    function clickNext() {
      if (i >= expected.length) {
        expect(seen).to.eql(expected);
        done();
        return;
      }
      links[i].click();
      setTimeout(() => {
        seen.push(getHeading());
        i++;
        clickNext();
      }, 200);
    }
    clickNext();
  });
});
