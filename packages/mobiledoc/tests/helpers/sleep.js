export default function(sleepMs) {
  return new Promise(res => setTimeout(() => res(), sleepMs));
}
