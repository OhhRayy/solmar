// Solmar story — five missions for Dax Mercer, a driver fresh out of the
// Solmar docks who owes fixer Lena Cruz one last favour. Each mission is a
// target on the map plus a payout; finishing all five is the finale.

(function (global) {
  'use strict';

  // Targets are fixed map points so the story reads the same every run.
  var MISSIONS = [
    {
      id: 1, title: 'First Errand', payout: 250,
      brief: 'Lena needs a package picked up at the marina kiosk. Walk or drive there — keep it quiet.',
      target: { x: 1229, y: 2829, label: 'Marina kiosk' },
      kind: 'goto'
    },
    {
      id: 2, title: 'Borrowed Wheels', payout: 400,
      brief: 'The pickup needs wheels. Take any car on the street — the owner will understand. Probably.',
      target: { x: 829, y: 1029, label: 'Parked coupe' },
      kind: 'steal'
    },
    {
      id: 3, title: 'The Handoff', payout: 650,
      brief: 'Drive the package to the old arcade on Coral Row. Cops are jumpy tonight — don\'t draw a crowd.',
      target: { x: 2229, y: 1429, label: 'Coral Row arcade' },
      kind: 'drive'
    },
    {
      id: 4, title: 'Heat Wave', payout: 900,
      brief: 'The drop went sideways. Lose the tail, then reach the rooftop garage on Harbor Heights.',
      target: { x: 2629, y: 629, label: 'Harbor Heights garage' },
      kind: 'escape'
    },
    {
      id: 5, title: 'The Big Score', payout: 2500,
      brief: 'One last job: the Solmar vault truck crosses the causeway at dawn. Take it, and the debt is paid.',
      target: { x: 1629, y: 229, label: 'Causeway vault truck' },
      kind: 'finale'
    }
  ];

  function missionAt(index) {
    if (index < 0 || index >= MISSIONS.length) return null;
    return MISSIONS[index];
  }

  function missionCount() { return MISSIONS.length; }

  function totalPayout() {
    var sum = 0;
    for (var i = 0; i < MISSIONS.length; i++) sum += MISSIONS[i].payout;
    return sum;
  }

  // How close the player must get to count a mission done (finale is tighter).
  function missionRadius(mission) {
    return mission && mission.kind === 'finale' ? 70 : 90;
  }

  // A one-line objective string for the HUD.
  function objectiveText(mission, done) {
    if (!mission) return 'All missions complete — Solmar is yours, Dax.';
    if (done) return 'Mission complete! Find Lena\'s next call.';
    return 'Mission ' + mission.id + ' — ' + mission.title + ': reach ' + mission.target.label + ' ($' + mission.payout + ')';
  }

  global.SolmarMissions = {
    MISSIONS: MISSIONS, missionAt: missionAt, missionCount: missionCount,
    totalPayout: totalPayout, missionRadius: missionRadius,
    objectiveText: objectiveText
  };
})(window);
