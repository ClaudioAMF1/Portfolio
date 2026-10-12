"""Atualiza assets/data/contributions.json com o calendário de contribuições
do GitHub (últimos 12 meses). Roda na GitHub Action diária; precisa de
GITHUB_TOKEN no ambiente."""
import datetime
import json
import os
import urllib.request

LOGIN = "ClaudioAMF1"
QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}
"""

request = urllib.request.Request(
    "https://api.github.com/graphql",
    data=json.dumps({"query": QUERY, "variables": {"login": LOGIN}}).encode(),
    headers={
        "Authorization": "bearer " + os.environ["GITHUB_TOKEN"],
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(request) as response:
    payload = json.load(response)

weeks = payload["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
days = {
    day["date"]: day["contributionCount"]
    for week in weeks
    for day in week["contributionDays"]
    if day["contributionCount"]
}
today = datetime.date.today()
data = {
    "source": "github",
    "label": "contribuições no GitHub de " + LOGIN,
    "from": (today - datetime.timedelta(days=364)).isoformat(),
    "to": today.isoformat(),
    "days": dict(sorted(days.items())),
}
with open("assets/data/contributions.json", "w", encoding="utf-8") as output:
    json.dump(data, output, ensure_ascii=False, indent=0)
    output.write("\n")
