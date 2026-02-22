import { mount } from 'svelte';
import Sidebar from './Sidebar.svelte';

mount(Sidebar, {
  target: document.getElementById('app')!,
});
